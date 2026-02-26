use anyhow::Result;
use bytemuck::{Pod, Zeroable};
use egui::{Color32, RichText, ViewportId};
use egui_wgpu::Renderer as EguiRenderer;
use egui_winit::State as EguiState;
use std::time::Instant;
use wgpu::util::DeviceExt;
use winit::{
    dpi::PhysicalSize,
    event::{ElementState, Event, MouseButton, MouseScrollDelta, WindowEvent},
    event_loop::EventLoop,
    window::WindowBuilder,
};

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct Params {
    resolution: [f32; 2],
    time: f32,
    mass: f32,
    spin: f32,
    accretion: f32,
    inclination: f32,
    disk_inner: f32,
    disk_outer: f32,
    grid_strength: f32,
    lensing: f32,
    cam_yaw: f32,
    cam_pitch: f32,
    zoom: f32,
    _pad0: f32,
    _pad1: f32,
}

#[derive(Clone)]
struct Settings {
    mass: f32,
    spin: f32,
    accretion: f32,
    inclination: f32,
    disk_inner: f32,
    disk_outer: f32,
    grid_strength: f32,
    lensing: f32,
    zoom: f32,
    cam_yaw: f32,
    cam_pitch: f32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            mass: 10.0,
            spin: 0.7,
            accretion: 0.6,
            inclination: 30.0,
            disk_inner: 1.1,
            disk_outer: 8.0,
            grid_strength: 0.6,
            lensing: 0.85,
            zoom: 1.0,
            cam_yaw: 0.0,
            cam_pitch: 0.0,
        }
    }
}

struct DragState {
    dragging: bool,
    last_x: f32,
    last_y: f32,
}

struct App {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    size: PhysicalSize<u32>,
    compute_pipeline: wgpu::ComputePipeline,
    render_pipeline: wgpu::RenderPipeline,
    output_texture: wgpu::Texture,
    output_view: wgpu::TextureView,
    output_sampler: wgpu::Sampler,
    compute_bind_group: wgpu::BindGroup,
    render_bind_group: wgpu::BindGroup,
    uniform_buffer: wgpu::Buffer,
    params: Params,
    start_time: Instant,
    settings: Settings,
    drag: DragState,
    egui_ctx: egui::Context,
    egui_state: EguiState,
    egui_renderer: EguiRenderer,
    window: winit::window::Window,
}

impl App {
    async fn new(window: winit::window::Window) -> Result<Self> {
        let size = window.inner_size();
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::default());
        let surface = instance.create_surface(&window)?;
        let surface: wgpu::Surface<'static> = unsafe {
            // Safety: `window` is stored in `App`, ensuring it outlives the surface.
            std::mem::transmute(surface)
        };
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or_else(|| anyhow::anyhow!("No suitable GPU adapter found"))?;

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("Device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                },
                None,
            )
            .await?;

        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps.formats[0];
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width.max(1),
            height: size.height.max(1),
            desired_maximum_frame_latency: 2,
            present_mode: surface_caps.present_modes[0],
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
        };
        surface.configure(&device, &config);
        let initial_resolution = [config.width as f32, config.height as f32];

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Black Hole Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("../shader.wgsl").into()),
        });

        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Params Buffer"),
            contents: bytemuck::bytes_of(&Params {
                resolution: [config.width as f32, config.height as f32],
                time: 0.0,
                mass: 10.0,
                spin: 0.7,
                accretion: 0.6,
                inclination: 30.0,
                disk_inner: 1.1,
                disk_outer: 8.0,
                grid_strength: 0.6,
                lensing: 0.85,
                cam_yaw: 0.0,
                cam_pitch: 0.0,
                zoom: 1.0,
                _pad0: 0.0,
                _pad1: 0.0,
            }),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        let (output_texture, output_view) = Self::create_output_texture(&device, &config);
        let output_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Output Sampler"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        let compute_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Compute Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::WriteOnly,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let compute_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Compute Pipeline Layout"),
            bind_group_layouts: &[&compute_bind_group_layout],
            push_constant_ranges: &[],
        });

        let compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Compute Pipeline"),
            layout: Some(&compute_pipeline_layout),
            module: &shader,
            entry_point: "cs_main",
        });

        let compute_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Compute Bind Group"),
            layout: &compute_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&output_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: uniform_buffer.as_entire_binding(),
                },
            ],
        });

        let render_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Render Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        multisampled: false,
                        view_dimension: wgpu::TextureViewDimension::D2,
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        let render_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Render Pipeline Layout"),
            bind_group_layouts: &[&render_bind_group_layout],
            push_constant_ranges: &[],
        });

        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Render Pipeline"),
            layout: Some(&render_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: "vs_main",
                buffers: &[],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: "fs_main",
                targets: &[Some(wgpu::ColorTargetState {
                    format: config.format,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
        });

        let render_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Render Bind Group"),
            layout: &render_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&output_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&output_sampler),
                },
            ],
        });

        let egui_ctx = egui::Context::default();
        let egui_state = EguiState::new(egui_ctx.clone(), ViewportId::ROOT, &window, None, None);
        let egui_renderer = EguiRenderer::new(&device, config.format, None, 1);

        Ok(Self {
            surface,
            device,
            queue,
            config,
            size,
            compute_pipeline,
            render_pipeline,
            output_texture,
            output_view,
            output_sampler,
            compute_bind_group,
            render_bind_group,
            uniform_buffer,
            params: Params {
                resolution: initial_resolution,
                time: 0.0,
                mass: 10.0,
                spin: 0.7,
                accretion: 0.6,
                inclination: 30.0,
                disk_inner: 1.1,
                disk_outer: 8.0,
                grid_strength: 0.6,
                lensing: 0.85,
                cam_yaw: 0.0,
                cam_pitch: 0.0,
                zoom: 1.0,
                _pad0: 0.0,
                _pad1: 0.0,
            },
            start_time: Instant::now(),
            settings: Settings::default(),
            drag: DragState {
                dragging: false,
                last_x: 0.0,
                last_y: 0.0,
            },
            egui_ctx,
            egui_state,
            egui_renderer,
            window,
        })
    }

    fn create_output_texture(
        device: &wgpu::Device,
        config: &wgpu::SurfaceConfiguration,
    ) -> (wgpu::Texture, wgpu::TextureView) {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Output Texture"),
            size: wgpu::Extent3d {
                width: config.width,
                height: config.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        (texture, view)
    }

    fn resize(&mut self, new_size: PhysicalSize<u32>) {
        if new_size.width == 0 || new_size.height == 0 {
            return;
        }
        self.size = new_size;
        self.config.width = new_size.width;
        self.config.height = new_size.height;
        self.surface.configure(&self.device, &self.config);
        let (tex, view) = Self::create_output_texture(&self.device, &self.config);
        self.output_texture = tex;
        self.output_view = view;
        self.compute_bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Compute Bind Group"),
            layout: &self.compute_pipeline.get_bind_group_layout(0),
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&self.output_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.uniform_buffer.as_entire_binding(),
                },
            ],
        });
        self.render_bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Render Bind Group"),
            layout: &self.render_pipeline.get_bind_group_layout(0),
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&self.output_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&self.output_sampler),
                },
            ],
        });
    }

    fn update_params(&mut self) {
        let elapsed = self.start_time.elapsed().as_secs_f32();
        self.params.resolution = [self.config.width as f32, self.config.height as f32];
        self.params.time = elapsed;
        self.params.mass = self.settings.mass;
        self.params.spin = self.settings.spin;
        self.params.accretion = self.settings.accretion;
        self.params.inclination = self.settings.inclination;
        self.params.disk_inner = self.settings.disk_inner;
        self.params.disk_outer = self.settings.disk_outer;
        self.params.grid_strength = self.settings.grid_strength;
        self.params.lensing = self.settings.lensing;
        self.params.cam_yaw = self.settings.cam_yaw;
        self.params.cam_pitch = self.settings.cam_pitch + self.settings.inclination.to_radians();
        self.params.zoom = self.settings.zoom;

        self.queue
            .write_buffer(&self.uniform_buffer, 0, bytemuck::bytes_of(&self.params));
    }

    fn handle_input(&mut self, event: &WindowEvent) -> bool {
        let response = self.egui_state.on_window_event(&self.window, event);
        if response.consumed {
            return true;
        }
        match event {
            WindowEvent::MouseInput { state, button, .. } => {
                if *button == MouseButton::Left {
                    self.drag.dragging = *state == ElementState::Pressed;
                }
                true
            }
            WindowEvent::CursorMoved { position, .. } => {
                if self.drag.dragging && !self.egui_ctx.wants_pointer_input() {
                    let dx = position.x as f32 - self.drag.last_x;
                    let dy = position.y as f32 - self.drag.last_y;
                    self.settings.cam_yaw += dx * 0.005;
                    self.settings.cam_pitch = (self.settings.cam_pitch + dy * 0.005)
                        .clamp(-1.2, 1.2);
                }
                self.drag.last_x = position.x as f32;
                self.drag.last_y = position.y as f32;
                true
            }
            WindowEvent::MouseWheel { delta, .. } => {
                let scroll = match delta {
                    MouseScrollDelta::LineDelta(_, y) => *y,
                    MouseScrollDelta::PixelDelta(p) => p.y as f32 / 50.0,
                };
                self.settings.zoom = (self.settings.zoom * (1.0 + scroll * 0.08)).clamp(0.3, 2.5);
                true
            }
            _ => false,
        }
    }

    fn ui(settings: &mut Settings, ctx: &egui::Context) {
        egui::Window::new("Black Hole Controls")
            .default_pos([24.0, 24.0])
            .resizable(false)
            .show(ctx, |ui| {
                ui.label(RichText::new("Rendering (Rust + wgpu)").color(Color32::from_rgb(120, 190, 255)));
                ui.add(egui::Slider::new(&mut settings.mass, 1.0..=1.0e10).logarithmic(true).text("Mass (Msun)"));
                ui.add(egui::Slider::new(&mut settings.spin, 0.0..=0.998).text("Spin"));
                ui.add(egui::Slider::new(&mut settings.accretion, 0.0..=2.0).text("Accretion"));
                ui.add(egui::Slider::new(&mut settings.inclination, 0.0..=80.0).text("Inclination"));
                ui.add(egui::Slider::new(&mut settings.disk_inner, 0.6..=3.0).text("Disk inner"));
                ui.add(egui::Slider::new(&mut settings.disk_outer, 3.0..=20.0).text("Disk outer"));
                ui.add(egui::Slider::new(&mut settings.lensing, 0.0..=1.5).text("Lensing"));
                ui.add(egui::Slider::new(&mut settings.grid_strength, 0.0..=1.0).text("Grid strength"));
                ui.add(egui::Slider::new(&mut settings.zoom, 0.3..=2.5).text("Zoom"));
                ui.separator();
                if ui.button("Reset camera").clicked() {
                    settings.cam_pitch = 0.0;
                    settings.cam_yaw = 0.0;
                }
                ui.label("Drag to orbit - Scroll to zoom");
            });
    }

    fn render(&mut self) -> Result<()> {
        self.update_params();

        let output = self.surface.get_current_texture()?;
        let view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());

        let raw_input = self.egui_state.take_egui_input(&self.window);
        let egui_ctx = &self.egui_ctx;
        let settings = &mut self.settings;
        let full_output = egui_ctx.run(raw_input, |ctx| Self::ui(settings, ctx));
        self.egui_state
            .handle_platform_output(&self.window, full_output.platform_output);

        let paint_jobs = self.egui_ctx.tessellate(full_output.shapes, full_output.pixels_per_point);

        for (id, image_delta) in &full_output.textures_delta.set {
            self.egui_renderer
                .update_texture(&self.device, &self.queue, *id, image_delta);
        }

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("Render Encoder") });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Compute Pass"),
                timestamp_writes: None,
            });
            compute_pass.set_pipeline(&self.compute_pipeline);
            compute_pass.set_bind_group(0, &self.compute_bind_group, &[]);
            let x = (self.config.width + 7) / 8;
            let y = (self.config.height + 7) / 8;
            compute_pass.dispatch_workgroups(x, y, 1);
        }

        let screen_desc = egui_wgpu::ScreenDescriptor {
            size_in_pixels: [self.config.width, self.config.height],
            pixels_per_point: self.window.scale_factor() as f32,
        };

        self.egui_renderer.update_buffers(
            &self.device,
            &self.queue,
            &mut encoder,
            &paint_jobs,
            &screen_desc,
        );

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            render_pass.set_pipeline(&self.render_pipeline);
            render_pass.set_bind_group(0, &self.render_bind_group, &[]);
            render_pass.draw(0..3, 0..1);
            self.egui_renderer
                .render(&mut render_pass, &paint_jobs, &screen_desc);
        }

        for id in &full_output.textures_delta.free {
            self.egui_renderer.free_texture(id);
        }

        self.queue.submit(Some(encoder.finish()));
        output.present();
        Ok(())
    }
}

fn main() -> Result<()> {
    let event_loop = EventLoop::new()?;
    let window = WindowBuilder::new()
        .with_title("Black Hole Visualizer (Rust)")
        .with_inner_size(PhysicalSize::new(1280, 720))
        .build(&event_loop)?;

    let mut app = pollster::block_on(App::new(window))?;

    event_loop.run(move |event, elwt| {
        match event {
            Event::WindowEvent { event, window_id } if window_id == app.window.id() => {
                if matches!(event, WindowEvent::CloseRequested) {
                    elwt.exit();
                    return;
                }
                match &event {
                    WindowEvent::Resized(size) => {
                        app.resize(*size);
                    }
                    WindowEvent::ScaleFactorChanged { .. } => {
                        app.resize(app.window.inner_size());
                    }
                    WindowEvent::RedrawRequested => {
                        if let Err(err) = app.render() {
                            eprintln!("Render error: {err}");
                        }
                    }
                    _ => {}
                }
                app.handle_input(&event);
            }
            Event::AboutToWait => {
                app.window.request_redraw();
            }
            _ => {}
        }
    })?;

    Ok(())
}
