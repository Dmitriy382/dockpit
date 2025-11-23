import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';
import { RefreshCw, Box, PlayCircle, StopCircle, X, Terminal, RotateCw, Menu, Container, Image, Network, Info, Activity, Settings, HardDrive, Wifi } from "lucide-react"; 

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

interface ImageInfo {
  id: string;
  repo_tags: string[];
  size: number;
  created: number;
}

interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
}

interface ContainerStats {
  cpu_percentage: number;
  memory_usage: number;
  memory_limit: number;
  memory_percentage: number;
  network_rx: number;
  network_tx: number;
  block_read: number;
  block_write: number;
}

interface PortMapping {
  container_port: number;
  host_ip: string;
  host_port: number;
  protocol: string;
}

interface VolumeMount {
  source: string;
  destination: string;
  mode: string;
  rw: boolean;
}

interface ContainerDetails {
  env: string[];
  ports: PortMapping[];
  volumes: VolumeMount[];
  networks: string[];
  hostname: string;
  image_id: string;
  created: string;
  restart_policy: string;
}

type ViewType = 'containers' | 'images' | 'networks';

function App() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<ContainerInfo | null>(null);
  const [detailsContainer, setDetailsContainer] = useState<ContainerInfo | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('containers');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function fetchContainers() {
    setLoading(true);
    try {
      const data = await invoke<ContainerInfo[]>("get_containers");
      setContainers(data);
    } catch (error) {
      console.error("Failed to fetch containers:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchImages() {
    setLoading(true);
    try {
      const data = await invoke<ImageInfo[]>("get_images");
      setImages(data);
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchNetworks() {
    setLoading(true);
    try {
      const data = await invoke<NetworkInfo[]>("get_networks");
      setNetworks(data);
    } catch (error) {
      console.error("Failed to fetch networks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: "start" | "stop") {
    try {
      const commandName = `${action}_container`; 
      await invoke(commandName, { id }); 
      await fetchContainers(); 
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      alert(`Backend Error: Failed to ${action} container ${id}. Check terminal.`);
    }
  }

  const handleRestart = async (id: string) => {
    try {
      await invoke('restart_container', { id });
      console.log(`Container ${id} restarted.`);
      fetchContainers();
    } catch (e) {
      console.error('Failed to restart container:', e);
      alert(`Backend Error: Failed to restart container ${id}.`);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить контейнер ${name}? Это действие необратимо.`)) {
      return;
    }
    try {
      await invoke('remove_container', { id });
      console.log(`Container ${id} removed.`);
      fetchContainers();
    } catch (e) {
      alert(`Ошибка: Не удалось удалить контейнер. Убедитесь, что он остановлен. Ошибка: ${e}`);
      console.error('Failed to remove container:', e);
    }
  };

  const handleRefresh = () => {
    if (currentView === 'containers') fetchContainers();
    else if (currentView === 'images') fetchImages();
    else if (currentView === 'networks') fetchNetworks();
  };

  const switchView = (view: ViewType) => {
    setCurrentView(view);
    setSidebarOpen(false);
    if (view === 'containers') fetchContainers();
    else if (view === 'images') fetchImages();
    else if (view === 'networks') fetchNetworks();
  };

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('ru-RU');
  };

  return (
    <div className="min-h-screen p-8 bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Box className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-extrabold tracking-tight">Dockpit</h1>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-full transition-colors shadow-lg"
          disabled={loading}
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-slate-800 border-r border-slate-700 transition-transform duration-300 z-50 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '280px' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-100">Меню</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => switchView('containers')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                currentView === 'containers'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <Container size={20} />
              <span className="font-medium">Контейнеры</span>
            </button>

            <button
              onClick={() => switchView('images')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                currentView === 'images'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <Image size={20} />
              <span className="font-medium">Образы</span>
            </button>

            <button
              onClick={() => switchView('networks')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                currentView === 'networks'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <Network size={20} />
              <span className="font-medium">Сети</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Content */}
      {currentView === 'containers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {containers.map((container) => (
            <div
              key={container.id}
              className="flex flex-col bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-xl transition-all hover:border-blue-500/50"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-xl truncate">{container.name}</h3>
                  <p className="text-slate-400 text-sm truncate max-w-[200px]" title={container.image}>
                    {container.image}
                  </p>
                </div>
                <StatusBadge state={container.state} />
              </div>

              <div className="text-xs text-slate-500 font-mono mb-4 border-b border-slate-700 pb-4">
                ID: {container.id}<br/>
                Status: {container.status}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <button 
                  onClick={() => handleAction(container.id, "start")}
                  disabled={container.state === "running"}
                  className={`py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-bold transition-all
                    ${container.state === "running" 
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50" 
                      : "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                    }`}
                >
                  <PlayCircle size={16} /> Start
                </button>

                <button 
                  onClick={() => handleAction(container.id, "stop")}
                  disabled={container.state !== "running"}
                  className={`py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-bold transition-all
                    ${container.state !== "running" 
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50" 
                      : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                    }`}
                >
                  <StopCircle size={16} /> Stop
                </button>
                
                <button 
                  onClick={() => handleRestart(container.id)}
                  disabled={container.state === "created"} 
                  className={`py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-bold transition-all
                    ${container.state === "created" 
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50" 
                      : "bg-orange-600/20 text-orange-400 hover:bg-orange-600/30"
                    }`}
                >
                  <RotateCw size={16} /> Restart
                </button>

                {container.state === 'exited' && (
                  <button
                    onClick={() => handleRemove(container.id, container.name)}
                    className="bg-red-600/20 text-red-400 hover:bg-red-600/30 py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-bold transition-all"
                  >
                    <X size={16} /> Remove
                  </button>
                )}

                <button 
                  onClick={() => setSelectedContainer(container)}
                  className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-bold transition-all"
                >
                  <Terminal size={16} /> Logs
                </button>

                <button 
                  onClick={() => setDetailsContainer(container)}
                  className="bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-bold transition-all"
                >
                  <Info size={16} /> Info
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {currentView === 'images' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image) => (
            <div
              key={image.id}
              className="flex flex-col bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-xl transition-all hover:border-purple-500/50"
            >
              <div className="mb-4">
                <h3 className="font-semibold text-xl mb-2 text-purple-400">
                  {image.repo_tags[0] || 'none'}
                </h3>
                {image.repo_tags.slice(1).map((tag, idx) => (
                  <p key={idx} className="text-slate-400 text-sm">{tag}</p>
                ))}
              </div>

              <div className="text-xs text-slate-500 font-mono space-y-1 border-t border-slate-700 pt-4">
                <div>ID: {image.id}</div>
                <div>Size: {formatBytes(image.size)}</div>
                <div>Created: {formatDate(image.created)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {currentView === 'networks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {networks.map((network) => (
            <div
              key={network.id}
              className="flex flex-col bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-xl transition-all hover:border-cyan-500/50"
            >
              <div className="mb-4">
                <h3 className="font-semibold text-xl text-cyan-400 mb-1">{network.name}</h3>
                <p className="text-slate-400 text-sm">{network.driver}</p>
              </div>

              <div className="text-xs text-slate-500 font-mono space-y-1 border-t border-slate-700 pt-4">
                <div>ID: {network.id}</div>
                <div>Scope: {network.scope}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {((currentView === 'containers' && containers.length === 0) ||
        (currentView === 'images' && images.length === 0) ||
        (currentView === 'networks' && networks.length === 0)) && !loading && (
        <div className="text-center text-slate-500 mt-20 p-10 bg-slate-800 rounded-lg">
          <p className="text-lg">
            {currentView === 'containers' && 'No containers found.'}
            {currentView === 'images' && 'No images found.'}
            {currentView === 'networks' && 'No networks found.'}
          </p>
        </div>
      )}

      {selectedContainer && (
        <LogsModal
          containerName={selectedContainer.name}
          containerId={selectedContainer.id}
          onClose={() => setSelectedContainer(null)}
        />
      )}

      {detailsContainer && (
        <DetailsModal
          container={detailsContainer}
          onClose={() => setDetailsContainer(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  const isRunning = state.toLowerCase() === "running";
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider shadow-inner ${
        isRunning
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : "bg-slate-700 text-slate-400 border border-slate-600"
      }`}
    >
      {state}
    </span>
  );
}

interface LogsModalProps {
  containerName: string;
  containerId: string;
  onClose: () => void;
}

function LogsModal({ containerName, containerId, onClose }: LogsModalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    invoke("stream_container_logs", { id: containerId }).catch(console.error);

    const unlisten = listen<string>('log-update', (event) => {
      setLogs(prevLogs => [...prevLogs, event.payload]);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [containerId]);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-4xl h-full max-h-[80vh] rounded-xl shadow-2xl flex flex-col border border-slate-700">
        <div className="p-4 flex justify-between items-center border-b border-slate-800">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Terminal size={20} className="text-blue-400" />
            Logs: <span className="text-slate-300 font-mono">{containerName}</span>
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm whitespace-pre text-slate-300 leading-relaxed bg-black/50 rounded-b-xl scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
          {logs.length === 0 ? (
            <div className="text-slate-500 text-center mt-10">Waiting for logs...</div>
          ) : (
            logs.map((line, index) => (
              <div key={index} className={line.toLowerCase().includes("error") ? "text-red-400" : ""}>
                {line}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

interface DetailsModalProps {
  container: ContainerInfo;
  onClose: () => void;
}

function DetailsModal({ container, onClose }: DetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'env' | 'ports' | 'volumes' | 'network'>('stats');
  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const detailsData = await invoke<ContainerDetails>("get_container_details", { id: container.id });
        setDetails(detailsData);
        
        if (container.state === 'running') {
          const statsData = await invoke<ContainerStats>("get_container_stats", { id: container.id });
          setStats(statsData);
        }
      } catch (error) {
        console.error("Failed to fetch container details:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    
    // Обновление статистики каждые 2 секунды для запущенных контейнеров
    let interval: number | undefined;
    if (container.state === 'running') {
      interval = window.setInterval(async () => {
        try {
          const statsData = await invoke<ContainerStats>("get_container_stats", { id: container.id });
          setStats(statsData);
        } catch (error) {
          console.error("Failed to refresh stats:", error);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [container.id, container.state]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-5xl h-full max-h-[85vh] rounded-xl shadow-2xl flex flex-col border border-slate-700">
        <div className="p-4 flex justify-between items-center border-b border-slate-800">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Info size={20} className="text-purple-400" />
            Details: <span className="text-slate-300 font-mono">{container.name}</span>
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'stats'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Activity size={18} /> Stats
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'env'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Settings size={18} /> Environment
          </button>
          <button
            onClick={() => setActiveTab('ports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'ports'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Wifi size={18} /> Ports
          </button>
          <button
            onClick={() => setActiveTab('volumes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'volumes'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <HardDrive size={18} /> Volumes
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'network'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Network size={18} /> Network
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : (
            <>
              {activeTab === 'stats' && (
                <div className="space-y-4">
                  {container.state !== 'running' ? (
                    <div className="text-center text-slate-500 py-10">
                      Container is not running. Stats unavailable.
                    </div>
                  ) : stats ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h4 className="text-sm font-semibold text-slate-400 mb-2">CPU Usage</h4>
                          <p className="text-3xl font-bold text-blue-400">{stats.cpu_percentage.toFixed(2)}%</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h4 className="text-sm font-semibold text-slate-400 mb-2">Memory Usage</h4>
                          <p className="text-3xl font-bold text-green-400">{stats.memory_percentage.toFixed(2)}%</p>
                          <p className="text-sm text-slate-500 mt-1">{formatBytes(stats.memory_usage)} / {formatBytes(stats.memory_limit)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h4 className="text-sm font-semibold text-slate-400 mb-2">Network I/O</h4>
                          <div className="space-y-1">
                            <p className="text-sm"><span className="text-purple-400">RX:</span> {formatBytes(stats.network_rx)}</p>
                            <p className="text-sm"><span className="text-orange-400">TX:</span> {formatBytes(stats.network_tx)}</p>
                          </div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h4 className="text-sm font-semibold text-slate-400 mb-2">Block I/O</h4>
                          <div className="space-y-1">
                            <p className="text-sm"><span className="text-cyan-400">Read:</span> {formatBytes(stats.block_read)}</p>
                            <p className="text-sm"><span className="text-red-400">Write:</span> {formatBytes(stats.block_write)}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-slate-500 py-10">Failed to load stats</div>
                  )}
                </div>
              )}

              {activeTab === 'env' && details && (
                <div className="space-y-2">
                  {details.env.length === 0 ? (
                    <p className="text-slate-500 text-center py-10">No environment variables</p>
                  ) : (
                    details.env.map((env, idx) => (
                      <div key={idx} className="bg-slate-800 p-3 rounded-lg border border-slate-700 font-mono text-sm">
                        {env}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'ports' && details && (
                <div className="space-y-2">
                  {details.ports.length === 0 ? (
                    <p className="text-slate-500 text-center py-10">No port mappings</p>
                  ) : (
                    details.ports.map((port, idx) => (
                      <div key={idx} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-blue-400 font-mono">{port.host_ip}:{port.host_port}</span>
                            <span className="text-slate-500 mx-2">→</span>
                            <span className="text-green-400 font-mono">{port.container_port}</span>
                          </div>
                          <span className="text-xs text-slate-500 uppercase">{port.protocol}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'volumes' && details && (
                <div className="space-y-2">
                  {details.volumes.length === 0 ? (
                    <p className="text-slate-500 text-center py-10">No volumes mounted</p>
                  ) : (
                    details.volumes.map((volume, idx) => (
                      <div key={idx} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-slate-500 uppercase">Source:</span>
                            <p className="font-mono text-sm text-blue-400 break-all">{volume.source}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 uppercase">Destination:</span>
                            <p className="font-mono text-sm text-green-400 break-all">{volume.destination}</p>
                          </div>
                          <div className="flex gap-4 text-xs">
                            <span className="text-slate-400">Mode: <span className="text-white">{volume.mode}</span></span>
                            <span className="text-slate-400">Access: <span className={volume.rw ? "text-green-400" : "text-red-400"}>{volume.rw ? "Read/Write" : "Read-Only"}</span></span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'network' && details && (
                <div className="space-y-4">
                  <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-400 mb-2">General Info</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-slate-500">Hostname:</span> <span className="font-mono text-cyan-400">{details.hostname}</span></p>
                      <p><span className="text-slate-500">Image ID:</span> <span className="font-mono text-purple-400">{details.image_id.slice(7, 19)}</span></p>
                      <p><span className="text-slate-500">Restart Policy:</span> <span className="text-orange-400">{details.restart_policy}</span></p>
                    </div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-400 mb-3">Connected Networks</h4>
                    {details.networks.length === 0 ? (
                      <p className="text-slate-500 text-sm">No networks connected</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {details.networks.map((network, idx) => (
                          <span key={idx} className="px-3 py-1 bg-cyan-600/20 text-cyan-400 rounded-full text-sm border border-cyan-500/30">
                            {network}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
