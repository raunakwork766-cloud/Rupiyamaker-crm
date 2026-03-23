#!/bin/bash
# RupiyaMe PM2 Management Script

PM2=/www/server/nodejs/v22.21.1/bin/pm2

case "$1" in
    status)
        echo "📊 Checking RupiyaMe services status..."
        $PM2 status
        ;;
    logs)
        if [ -z "$2" ]; then
            echo "📋 Showing all logs (Ctrl+C to exit)..."
            $PM2 logs
        else
            echo "📋 Showing $2 logs (Ctrl+C to exit)..."
            $PM2 logs "$2"
        fi
        ;;
    restart)
        if [ -z "$2" ]; then
            echo "🔄 Restarting all services..."
            $PM2 restart all
        else
            echo "🔄 Restarting $2..."
            $PM2 restart "$2"
        fi
        ;;
    stop)
        if [ -z "$2" ]; then
            echo "⏹️  Stopping all services..."
            $PM2 stop all
        else
            echo "⏹️  Stopping $2..."
            $PM2 stop "$2"
        fi
        ;;
    start)
        echo "▶️  Starting services..."
        cd /www/wwwroot/RupiyaMe
        $PM2 start ecosystem.config.js
        ;;
    reload)
        if [ -z "$2" ]; then
            echo "🔃 Reloading all services..."
            $PM2 reload all
        else
            echo "🔃 Reloading $2..."
            $PM2 reload "$2"
        fi
        ;;
    monitor)
        echo "📊 Opening PM2 monitor (Ctrl+C to exit)..."
        $PM2 monit
        ;;
    info)
        if [ -z "$2" ]; then
            echo "ℹ️  Please specify a service: backend or frontend"
        else
            $PM2 info "$2"
        fi
        ;;
    save)
        echo "💾 Saving PM2 configuration..."
        $PM2 save
        ;;
    *)
        echo "RupiyaMe PM2 Management Script"
        echo ""
        echo "Usage: $0 {command} [service]"
        echo ""
        echo "Commands:"
        echo "  status          - Show status of all services"
        echo "  logs [service]  - Show logs (all or specific service)"
        echo "  restart [service] - Restart services (all or specific)"
        echo "  stop [service]  - Stop services (all or specific)"
        echo "  start           - Start all services"
        echo "  reload [service] - Reload services (zero-downtime)"
        echo "  monitor         - Open PM2 monitor dashboard"
        echo "  info <service>  - Show detailed info about a service"
        echo "  save            - Save current PM2 configuration"
        echo ""
        echo "Services:"
        echo "  rupiyame-backend   - Python FastAPI backend"
        echo "  rupiyame-frontend  - Vite React frontend"
        echo ""
        echo "Examples:"
        echo "  $0 status"
        echo "  $0 logs rupiyame-backend"
        echo "  $0 restart rupiyame-frontend"
        ;;
esac
