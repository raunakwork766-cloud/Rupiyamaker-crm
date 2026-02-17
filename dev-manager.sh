#!/bin/bash

# 🚀 RupiyaMe Development Environment Manager
# Easy commands to manage Production & Development environments

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

show_status() {
    echo -e "${BOLD}=== Current Status ===${NC}"
    
    # Check current git branch
    current_branch=$(git branch --show-current)
    echo -e "${BLUE}📌 Git Branch:${NC} ${BOLD}$current_branch${NC}"
    
    # Check PM2 processes
    echo -e "\n${BLUE}📊 Running Services:${NC}"
    pm2 list
    
    echo -e "\n${BLUE}🌐 Access URLs:${NC}"
    echo -e "  ${GREEN}Production:${NC}"
    echo -e "    - Frontend: http://localhost:4521"
    echo -e "    - Backend:  http://localhost:8049"
    echo -e "\n  ${YELLOW}Development:${NC}"
    echo -e "    - Frontend: http://localhost:4522"
    echo -e "    - Backend:  http://localhost:8050"
}

start_production() {
    echo -e "${BOLD}${GREEN}🚀 Starting Production Environment...${NC}"
    git checkout main
    pm2 restart all
    echo -e "${GREEN}✅ Production running on ports: Backend=8049, Frontend=4521${NC}"
}

start_dev() {
    echo -e "${BOLD}${YELLOW}🔧 Starting Development Environment...${NC}"
    
    # Check if already running
    if pm2 describe rupiyame-backend-dev &>/dev/null; then
        echo -e "${YELLOW}⚠️  Dev environment already running. Restarting...${NC}"
        pm2 restart ecosystem.dev.config.js
    else
        git checkout dev
        pm2 start ecosystem.dev.config.js
    fi
    
    echo -e "${GREEN}✅ Development running on ports: Backend=8050, Frontend=4522${NC}"
}

stop_dev() {
    echo -e "${BOLD}${RED}🛑 Stopping Development Environment...${NC}"
    pm2 delete rupiyame-backend-dev rupiyame-frontend-dev 2>/dev/null
    echo -e "${GREEN}✅ Development stopped${NC}"
}

stop_production() {
    echo -e "${BOLD}${RED}⚠️  Stopping Production Environment...${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        pm2 stop rupiyame-backend rupiyame-frontend
        echo -e "${GREEN}✅ Production stopped${NC}"
    else
        echo -e "${YELLOW}Cancelled${NC}"
    fi
}

view_logs() {
    env=$1
    if [ "$env" = "dev" ]; then
        echo -e "${YELLOW}📜 Development Logs:${NC}"
        pm2 logs rupiyame-backend-dev rupiyame-frontend-dev
    elif [ "$env" = "prod" ]; then
        echo -e "${GREEN}📜 Production Logs:${NC}"
        pm2 logs rupiyame-backend rupiyame-frontend
    else
        echo -e "${BLUE}📜 All Logs:${NC}"
        pm2 logs
    fi
}

deploy_to_production() {
    echo -e "${BOLD}${GREEN}🚀 Deploying Dev to Production...${NC}"
    
    current_branch=$(git branch --show-current)
    
    # Ensure we're on dev branch
    git checkout dev
    
    echo -e "${YELLOW}📋 Changes to be deployed:${NC}"
    git log main..dev --oneline
    
    echo ""
    read -p "Deploy these changes to production? (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        echo -e "${BLUE}🔄 Merging dev into main...${NC}"
        git checkout main
        git merge dev --no-edit
        
        echo -e "${BLUE}🔄 Restarting production...${NC}"
        pm2 restart all
        
        echo -e "${GREEN}✅ Deploy complete! Production updated.${NC}"
        show_status
    else
        echo -e "${YELLOW}❌ Deploy cancelled${NC}"
        git checkout $current_branch
    fi
}

show_help() {
    echo -e "${BOLD}🚀 RupiyaMe Development Manager${NC}\n"
    echo -e "Usage: ./dev-manager.sh [command]\n"
    echo -e "${BOLD}Commands:${NC}"
    echo -e "  ${GREEN}status${NC}        - Show current status of all services"
    echo -e "  ${GREEN}prod${NC}          - Start/Restart production environment"
    echo -e "  ${YELLOW}dev${NC}           - Start development environment"
    echo -e "  ${RED}stop-dev${NC}      - Stop development environment"
    echo -e "  ${RED}stop-prod${NC}     - Stop production environment"
    echo -e "  ${BLUE}logs [env]${NC}    - View logs (env: prod/dev/all)"
    echo -e "  ${GREEN}deploy${NC}        - Deploy dev changes to production"
    echo -e "  ${BLUE}help${NC}          - Show this help\n"
    
    echo -e "${BOLD}Examples:${NC}"
    echo -e "  ./dev-manager.sh status"
    echo -e "  ./dev-manager.sh dev"
    echo -e "  ./dev-manager.sh logs dev"
    echo -e "  ./dev-manager.sh deploy\n"
    
    echo -e "${BOLD}🌐 Default URLs:${NC}"
    echo -e "  Production: Frontend=4521, Backend=8049"
    echo -e "  Development: Frontend=4522, Backend=8050"
}

# Main script
cd /www/wwwroot/RupiyaMe

case "$1" in
    status)
        show_status
        ;;
    prod|production)
        start_production
        ;;
    dev|development)
        start_dev
        ;;
    stop-dev)
        stop_dev
        ;;
    stop-prod)
        stop_production
        ;;
    logs)
        view_logs "$2"
        ;;
    deploy)
        deploy_to_production
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}\n"
        show_help
        exit 1
        ;;
esac
