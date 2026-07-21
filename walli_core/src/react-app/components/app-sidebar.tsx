import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  IconDashboard,
  IconKey,
  IconMessages,
  IconSettings,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "@/components/brand-mark";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({
  user,
  onSignOut,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  onSignOut: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const data = {
    navMain: [
      {
        activePrefix: "/",
        title: t("navDashboard"),
        to: "/",
        icon: IconDashboard,
      },
      {
        activePrefix: "/settings",
        title: t("navSettings"),
        to: "/settings/$tab",
        params: {
          tab: "basic",
        },
        icon: IconSettings,
      },
      {
        activePrefix: "/clients",
        title: t("navKeys"),
        to: "/clients/$platform/$tab",
        params: {
          platform: "telegram",
          tab: "basic",
        },
        icon: IconKey,
      },
      {
        activePrefix: "/chat-test",
        title: t("navChatTest"),
        to: "/chat-test",
        icon: IconMessages,
      },
    ],
    navSecondary: [],
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link to="/">
                <BrandMark />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onSignOut={onSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}
