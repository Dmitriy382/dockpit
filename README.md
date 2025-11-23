# 🐳 Dockpit

**Dockpit** — современный графический интерфейс для управления Docker контейнерами, образами и сетями, написанный на Rust (Tauri) + React + TypeScript.

![Dockpit Demo](./assets/dockpit.gif)

## ✨ Возможности

🖥️ Управление контейнерами

▶️ Запуск, остановка и перезапуск контейнеров

🗑️ Удаление контейнеров

📊 Просмотр логов в реальном времени

📈 Мониторинг состояния (running/exited/created)

🔄 Автоматическое обновление списка каждые 5 секунд

🖼️ Управление образами

📋 Просмотр всех локальных Docker образов

📏 Отображение размера и даты создания

🏷️ Просмотр тегов образов

🌐 Управление сетями

🔍 Просмотр всех Docker сетей

📊 Информация о драйверах и scope

🏠 Локальное подключение - прямое подключение к локальному Docker daemon

🔒 SSH Туннель - безопасное подключение к удаленным Docker серверам через SSH

🔄 Переключение между несколькими хостами


___
### SSH Туннелирование - Подробная инструкция
Dockpit использует SSH туннель для безопасного подключения к удаленному Docker. Вот что происходит под капотом:

- Для возможности пользоваться необходимо для начала настроить ssh-тунель к машине, к которой хотите подключиться 
- Docker socket удаленного сервера пробрасывается на локальный порт
- Dockpit подключается к локальному порту как к обычному Docker API

---

### 📋 Требования на удаленном сервере
Перед подключением убедитесь, что на удаленном сервере:
##### 1. Docker установлен и запущен
##### 2. Docker socket доступен

##### 3. Пользователь добавлен в группу docker
- sudo usermod -aG docker $USER

- ВАЖНО: Если команды требует sudo, SSH туннель не будет работать! Обязательно добавьте пользователя в группу docker.

4. SSH сервер установлен и запущен
---
##### 📡 Добавление SSH хоста в Dockpit

- Запустите Dockpit
- Нажмите на "+"
- Нажмите "Добавить хост"
- Выберите "SSH Туннель"

![Dockpit ssh connections demo](./assets/ssh-conection-demo.gif)
---

## 📦 Установка зависимостей по дистрибутивам

### 🔷 Arch Linux / Manjaro

```bash
# Обновление системы
sudo pacman -Syu

# Установка зависимостей Tauri
sudo pacman -S webkit2gtk base-devel curl wget file openssl gtk3 librsvg

# Установка Rust (если еще не установлен)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Установка Node.js и npm
sudo pacman -S nodejs npm

# Установка Docker
sudo pacman -S docker docker-compose

# Запуск и автозапуск Docker
sudo systemctl start docker
sudo systemctl enable docker

# Добавление пользователя в группу docker (чтобы не использовать sudo)
sudo usermod -aG docker $USER
# ВАЖНО: Перезайдите в систему или выполните: newgrp docker
```

### 🔶 Ubuntu / Debian / Linux Mint

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка зависимостей Tauri
sudo apt install -y libsoup-3.0-dev libjavascriptcoregtk-4.1-dev libwebkit2gtk-4.1-dev build-essential curl wget file  libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# Установка Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Установка Node.js 18+ (через NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установка Docker
sudo apt install -y docker.io docker-compose

# Запуск и автозапуск Docker
sudo systemctl start docker
sudo systemctl enable docker

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
# ВАЖНО: Перезайдите в систему или выполните: newgrp docker
```

### 🔴 Fedora / RHEL / CentOS

```bash
# Обновление системы
sudo dnf update -y

# Установка зависимостей Tauri
sudo dnf install -y webkit2gtk4.0-devel \
    openssl-devel \
    curl \
    wget \
    file \
    gcc \
    gcc-c++ \
    gtk3-devel \
    librsvg2-devel

# Установка Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Установка Node.js
sudo dnf install -y nodejs npm

# Установка Docker
sudo dnf install -y docker docker-compose

# Запуск и автозапуск Docker
sudo systemctl start docker
sudo systemctl enable docker

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
# ВАЖНО: Перезайдите в систему или выполните: newgrp docker
```

### 🟢 openSUSE

```bash
# Обновление системы
sudo zypper refresh && sudo zypper update -y

# Установка зависимостей Tauri
sudo zypper install -y webkit2gtk3-devel \
    libopenssl-devel \
    curl \
    wget \
    file \
    gcc \
    gcc-c++ \
    gtk3-devel \
    librsvg-devel

# Установка Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Установка Node.js
sudo zypper install -y nodejs npm

# Установка Docker
sudo zypper install -y docker docker-compose

# Запуск и автозапуск Docker
sudo systemctl start docker
sudo systemctl enable docker

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
# ВАЖНО: Перезайдите в систему или выполните: newgrp docker
```

---

## 🚀 Установка и запуск Dockpit

### 1. Клонирование репозитория

```bash
git clone https://github.com/Dmitriy382/dockpit.git
cd dockpit
```

### 2. Установка зависимостей Node.js

```bash
npm install
```

### 3. Запуск в режиме разработки

#### Для обычных окружений (GNOME, KDE, XFCE и т.д.):

```bash
npm run tauri:dev
```

#### Для Wayland композиторов (Hyprland, Sway и т.д.):

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri:dev
```

**Примечание**: На Hyprland и других тайловых композиторах Wayland может потребоваться отключение композитинга для корректной работы WebKit.

### 4. Сборка production версии

```bash
npm run tauri:build
```

Собранное приложение будет находиться в `src-tauri/target/release/bundle/`

---

## 🐋 Конфигурация Docker

### Подключение к Docker socket

По умолчанию Dockpit подключается к Docker через Unix socket:
- Linux: `/var/run/docker.sock`

Убедитесь, что ваш пользователь добавлен в группу `docker`:

```bash
# Проверить принадлежность к группе
groups $USER

# Если docker нет в списке, добавить:
sudo usermod -aG docker $USER

# Применить изменения (или перезайдите в систему)
newgrp docker
```

### Использование с Podman

Dockpit также работает с Podman! Создайте симлинк для совместимости:

```bash
# Включить Podman socket
systemctl --user enable --now podman.socket

# Создать симлинк (опционально, для совместимости)
sudo ln -s /run/user/$UID/podman/podman.sock /var/run/docker.sock
```

---

## 📁 Структура проекта

```
dockpit/
├── src/                    # React frontend
│   ├── App.tsx            # Главный компонент приложения
│   ├── App.css            # Стили (не используется, используется Tailwind)
│   └── index.css          # Глобальные стили Tailwind
├── src-tauri/             # Rust backend
│   ├── src/
│   │   └── main.rs        # Главный файл Rust с командами Tauri
│   ├── Cargo.toml         # Зависимости Rust
│   └── tauri.conf.json    # Конфигурация Tauri
├── package.json           # Зависимости Node.js
└── README.md              # Этот файл
```

---

## 🔧 Технологии

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Rust, Tauri v2, Bollard (Docker API)
- **Icons**: Lucide React


---

## 📞 Контакты

- GitHub: [github.com/Dmitriy382/dockpit](https://github.com/Dmitriy382/dockpit)
- :airplane: Telegram: [https://t.me/dockpit](https://t.me/dockpit)
---
⭐ Если проект был полезен - поставьте звезду на GitHub!
