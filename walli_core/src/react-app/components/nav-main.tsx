import { type Icon } from "@tabler/icons-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type NavMainItem =
    {
      activePrefix: string;
      icon?: Icon;
      title: string;
    } & (
      | { params?: never; to: "/" | "/chat-test" | "/clients" }
      | { params: { tab: string }; to: "/settings/$tab" }
      | { params: { platform: string; tab: string }; to: "/clients/$platform/$tab" }
    );

export function NavMain({
  items,
}: {
  items: NavMainItem[];
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isItemActive = (activePrefix: string) =>
    activePrefix === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(activePrefix);
  const getHref = (item: (typeof items)[number]) => {
    if (item.to === "/" || item.to === "/chat-test" || item.to === "/clients") {
      return item.to;
    }

    if (item.to === "/settings/$tab") {
      return `/settings/${item.params.tab}`;
    }

    if (item.to === "/clients/$platform/$tab") {
      return `/clients/${item.params.platform}/${item.params.tab}`;
    }
    return "/";
  };
  const handleNavigate = (
    event: MouseEvent<HTMLAnchorElement>,
    item: (typeof items)[number],
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();

    if (item.to === "/" || item.to === "/chat-test" || item.to === "/clients") {
      void navigate({ to: item.to });
      return;
    }

    if (item.to === "/settings/$tab") {
      void navigate({ to: item.to, params: item.params! });
    } else {
      void navigate({ to: item.to, params: item.params! });
    }
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isItemActive(item.activePrefix)}
              >
                <a
                  href={getHref(item)}
                  onClickCapture={(event) => handleNavigate(event, item)}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
