"use client"
import { Database, Globe, Settings, Sliders, PlayCircle, HelpCircle } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar"

export function AppSidebar({ activeTab, handleNavClick }) {
  return (
    <Sidebar className="border-r border-slate-800 bg-gradient-to-b from-slate-900/95 to-gray-900/90">
      <SidebarHeader className="p-4">
        <div className="relative text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-blue-500 to-teal-500 tracking-tighter animate-gradient-shift">
          DIVYALINK
          <span className="absolute -bottom-2 left-0 text-xs text-slate-200 font-light tracking-widest opacity-90">
            by Vayunotics
          </span>
          <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-teal-500/30 blur-xl opacity-70 animate-pulse-slow"></div>
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-teal-500/20 blur-md opacity-50 animate-pulse-slow"></div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "DATA"}
                  onClick={() => handleNavClick("DATA")}
                  className="text-slate-100 hover:text-white transition-all duration-300"
                >
                  <Database size={22} />
                  <span>DATA</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "PLAN"}
                  onClick={() => handleNavClick("PLAN")}
                  className="text-slate-100 hover:text-white transition-all duration-300"
                >
                  <Globe size={22} />
                  <span>PLAN</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "SETUP"}
                  onClick={() => handleNavClick("SETUP")}
                  className="text-slate-100 hover:text-white transition-all duration-300"
                >
                  <Settings size={22} />
                  <span>SETUP</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "CONFIG"}
                  onClick={() => handleNavClick("CONFIG")}
                  className="text-slate-100 hover:text-white transition-all duration-300"
                >
                  <Sliders size={22} />
                  <span>CONFIG</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "SIMULATION"}
                  onClick={() => handleNavClick("SIMULATION")}
                  className="text-slate-100 hover:text-white transition-all duration-300"
                >
                  <PlayCircle size={22} />
                  <span>SIMULATION</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "HELP"}
                  onClick={() => handleNavClick("HELP")}
                  className="text-slate-100 hover:text-white transition-all duration-300"
                >
                  <HelpCircle size={22} />
                  <span>HELP</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

