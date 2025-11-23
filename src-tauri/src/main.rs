#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use bollard::container::LogOutput;
use bollard::query_parameters::{
    LogsOptions, 
    ListContainersOptionsBuilder, 
    StartContainerOptionsBuilder, 
    StopContainerOptionsBuilder,
    RemoveContainerOptionsBuilder,
    RestartContainerOptionsBuilder,
    ListImagesOptionsBuilder,
    ListNetworksOptionsBuilder,
    InspectContainerOptions,
    StatsOptions,
};
use bollard::Docker;
use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;
use futures_util::StreamExt; 
use tauri::Emitter; 
use std::default::Default;

// Структура для контейнера
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
}

// Структура для образа
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ImageInfo {
    pub id: String,
    pub repo_tags: Vec<String>,
    pub size: i64,
    pub created: i64,
}

// Структура для сети
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NetworkInfo {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub scope: String,
}

// НОВЫЕ СТРУКТУРЫ для детальной информации

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ContainerStats {
    pub cpu_percentage: f64,
    pub memory_usage: u64,
    pub memory_limit: u64,
    pub memory_percentage: f64,
    pub network_rx: u64,
    pub network_tx: u64,
    pub block_read: u64,
    pub block_write: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PortMapping {
    pub container_port: u16,
    pub host_ip: String,
    pub host_port: u16,
    pub protocol: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VolumeMount {
    pub source: String,
    pub destination: String,
    pub mode: String,
    pub rw: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ContainerDetails {
    pub env: Vec<String>,
    pub ports: Vec<PortMapping>,
    pub volumes: Vec<VolumeMount>,
    pub networks: Vec<String>,
    pub hostname: String,
    pub image_id: String,
    pub created: String,
    pub restart_policy: String,
}

#[tauri::command]
async fn get_containers() -> Result<Vec<ContainerInfo>, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = ListContainersOptionsBuilder::default()
        .all(true)
        .build();

    let containers = docker.list_containers(Some(options)).await
        .map_err(|e| format!("Failed to list containers: {}", e))?;

    let result: Vec<ContainerInfo> = containers.into_iter().map(|c| {
        let name = c.names.unwrap_or_default().first().cloned().unwrap_or_else(|| "Unknown".to_string());
        let clean_name = if name.starts_with('/') { name[1..].to_string() } else { name };

        let state_str = c.state
            .map(|s| s.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        ContainerInfo {
            id: c.id.unwrap_or_default()[..12].to_string(),
            name: clean_name,
            image: c.image.unwrap_or_default(),
            state: state_str,
            status: c.status.unwrap_or_default(),
        }
    }).collect();

    Ok(result)
}

// НОВАЯ КОМАНДА: Получить детальную информацию о контейнере
#[tauri::command]
async fn get_container_details(id: String) -> Result<ContainerDetails, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    // ИСПРАВЛЕНИЕ: Явно указываем тип для None
    let container = docker.inspect_container(&id, None::<InspectContainerOptions>).await
        .map_err(|e| format!("Failed to inspect container: {}", e))?;

    // Переменные окружения
    let env = container.config.as_ref()
        .and_then(|c| c.env.clone())
        .unwrap_or_default();

    // Порты
    let mut ports = Vec::new();
    if let Some(ref network_settings) = container.network_settings {
        if let Some(ref port_bindings) = network_settings.ports {
            for (container_port, host_bindings) in port_bindings {
                if let Some(bindings) = host_bindings {
                    for binding in bindings {
                        let port_num: u16 = container_port
                            .split('/')
                            .next()
                            .and_then(|p| p.parse().ok())
                            .unwrap_or(0);
                        
                        let protocol = container_port
                            .split('/')
                            .nth(1)
                            .unwrap_or("tcp")
                            .to_string();

                        ports.push(PortMapping {
                            container_port: port_num,
                            host_ip: binding.host_ip.clone().unwrap_or_else(|| "0.0.0.0".to_string()),
                            host_port: binding.host_port.as_ref().and_then(|p| p.parse().ok()).unwrap_or(0),
                            protocol,
                        });
                    }
                }
            }
        }
    }

    // Volumes
    let mut volumes = Vec::new();
    if let Some(mounts) = container.mounts {
        for mount in mounts {
            volumes.push(VolumeMount {
                source: mount.source.unwrap_or_default(),
                destination: mount.destination.unwrap_or_default(),
                mode: mount.mode.unwrap_or_default(),
                rw: mount.rw.unwrap_or(true),
            });
        }
    }

    // Сети
    let mut networks = Vec::new();
    if let Some(ref network_settings) = container.network_settings {
        if let Some(nets) = &network_settings.networks {
            networks = nets.keys().cloned().collect();
        }
    }

    let hostname = container.config.as_ref()
        .and_then(|c| c.hostname.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    
    let restart_policy = container.host_config
        .and_then(|hc| hc.restart_policy)
        .and_then(|rp| rp.name)
        .map(|name| name.to_string())
        .unwrap_or_else(|| "no".to_string());

    let details = ContainerDetails {
        env,
        ports,
        volumes,
        networks,
        hostname,
        image_id: container.image.unwrap_or_default(),
        created: container.created.unwrap_or_default(),
        restart_policy,
    };

    Ok(details)
}

// НОВАЯ КОМАНДА: Получить статистику контейнера
#[tauri::command]
async fn get_container_stats(id: String) -> Result<ContainerStats, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    // ИСПРАВЛЕНИЕ: Используем правильный StatsOptions из query_parameters
    let options = StatsOptions {
        stream: false,
        one_shot: true,
    };

    let mut stats_stream = docker.stats(&id, Some(options));

    if let Some(stats_result) = stats_stream.next().await {
        let stats = stats_result.map_err(|e| format!("Failed to get stats: {}", e))?;

        // ИСПРАВЛЕНИЕ: Обрабатываем Option для cpu_stats и precpu_stats
        let cpu_stats = stats.cpu_stats.unwrap_or_default();
        let precpu_stats = stats.precpu_stats.unwrap_or_default();
        
        // Расчет CPU процента
        let cpu_delta = cpu_stats.cpu_usage.as_ref()
            .and_then(|u| u.total_usage)
            .unwrap_or(0) as f64
            - precpu_stats.cpu_usage.as_ref()
                .and_then(|u| u.total_usage)
                .unwrap_or(0) as f64;
        
        let system_delta = cpu_stats.system_cpu_usage.unwrap_or(0) as f64
            - precpu_stats.system_cpu_usage.unwrap_or(0) as f64;
        
        let cpu_percentage = if system_delta > 0.0 && cpu_delta > 0.0 {
            (cpu_delta / system_delta) * cpu_stats.online_cpus.unwrap_or(1) as f64 * 100.0
        } else {
            0.0
        };

        // ИСПРАВЛЕНИЕ: Обрабатываем Option для memory_stats
        let memory_stats = stats.memory_stats.unwrap_or_default();
        let memory_usage = memory_stats.usage.unwrap_or(0);
        let memory_limit = memory_stats.limit.unwrap_or(1);
        let memory_percentage = (memory_usage as f64 / memory_limit as f64) * 100.0;

        // Network
        let mut network_rx = 0u64;
        let mut network_tx = 0u64;
        if let Some(networks) = stats.networks {
            for (_name, net_stats) in networks {
                // ИСПРАВЛЕНИЕ: Обрабатываем Option для rx_bytes и tx_bytes
                network_rx += net_stats.rx_bytes.unwrap_or(0);
                network_tx += net_stats.tx_bytes.unwrap_or(0);
            }
        }

        // Block I/O
        let mut block_read = 0u64;
        let mut block_write = 0u64;
        // ИСПРАВЛЕНИЕ: Обрабатываем Option для blkio_stats
        if let Some(blkio) = stats.blkio_stats {
            if let Some(blkio_stats) = blkio.io_service_bytes_recursive {
                for entry in blkio_stats {
                    if let Some(op) = entry.op {
                        if op.to_lowercase() == "read" {
                            block_read += entry.value.unwrap_or(0);
                        } else if op.to_lowercase() == "write" {
                            block_write += entry.value.unwrap_or(0);
                        }
                    }
                }
            }
        }

        return Ok(ContainerStats {
            cpu_percentage,
            memory_usage,
            memory_limit,
            memory_percentage,
            network_rx,
            network_tx,
            block_read,
            block_write,
        });
    }

    Err("No stats available".to_string())
}

#[tauri::command]
async fn get_images() -> Result<Vec<ImageInfo>, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = ListImagesOptionsBuilder::default()
        .all(false)
        .build();

    let images = docker.list_images(Some(options)).await
        .map_err(|e| format!("Failed to list images: {}", e))?;

    let result: Vec<ImageInfo> = images.into_iter().map(|img| {
        ImageInfo {
            id: img.id[7..19].to_string(),
            repo_tags: img.repo_tags,
            size: img.size,
            created: img.created,
        }
    }).collect();

    Ok(result)
}

#[tauri::command]
async fn get_networks() -> Result<Vec<NetworkInfo>, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = ListNetworksOptionsBuilder::default().build();

    let networks = docker.list_networks(Some(options)).await
        .map_err(|e| format!("Failed to list networks: {}", e))?;

    let result: Vec<NetworkInfo> = networks.into_iter().map(|net| {
        NetworkInfo {
            id: net.id.unwrap_or_default()[..12].to_string(),
            name: net.name.unwrap_or_else(|| "Unknown".to_string()),
            driver: net.driver.unwrap_or_else(|| "Unknown".to_string()),
            scope: net.scope.unwrap_or_else(|| "local".to_string()),
        }
    }).collect();

    Ok(result)
}

#[tauri::command]
async fn start_container(id: String) -> Result<(), String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Connection failed: {}", e))?;

    let options = StartContainerOptionsBuilder::default().build();
    docker.start_container(&id, Some(options))
        .await
        .map_err(|e| format!("Failed to start: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn stop_container(id: String) -> Result<(), String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Connection failed: {}", e))?;

    let options = StopContainerOptionsBuilder::default().build();
    docker.stop_container(&id, Some(options))
        .await
        .map_err(|e| format!("Failed to stop: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn stream_container_logs(
    id: String,
    window: tauri::Window, 
) -> Result<(), String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = Some(LogsOptions {
        follow: true, 
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: "100".to_string(), 
        ..Default::default()
    });

    let mut log_stream = docker.logs(&id, options); 

    let (tx, rx) = oneshot::channel();
    let tx = std::sync::Mutex::new(Some(tx));

    let _unlisten = window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Some(tx) = tx.lock().unwrap().take() {
                let _ = tx.send(());
            }
        }
    });

    let mut destroy_future = Box::pin(rx); 

    while let Some(item) = tokio::select! {
        item = log_stream.next() => item,
        _ = &mut destroy_future => None,
    } {
        match item {
            Ok(msg) => {
                let log_text = match msg {
                    LogOutput::StdOut { message } | LogOutput::StdErr { message } => {
                        String::from_utf8_lossy(&message).trim().to_string()
                    },
                    _ => continue, 
                };
                
                window.emit("log-update", log_text)
                    .map_err(|e| format!("Failed to emit log: {}", e))?;
            },
            Err(e) => {
                eprintln!("Log stream error: {}", e);
                break;
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn remove_container(id: String) -> Result<(), String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Connection failed: {}", e))?;

    let options = RemoveContainerOptionsBuilder::default().build(); 
    
    docker.remove_container(&id, Some(options)) 
        .await
        .map_err(|e| format!("Failed to remove container: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn restart_container(id: String) -> Result<(), String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Connection failed: {}", e))?;

    let options = RestartContainerOptionsBuilder::default().build();

    docker.restart_container(&id, Some(options))
        .await
        .map_err(|e| format!("Failed to restart container: {}", e))?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_containers,
            get_container_details,
            get_container_stats,
            get_images,
            get_networks,
            start_container,
            stop_container,
            remove_container,
            restart_container,
            stream_container_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
