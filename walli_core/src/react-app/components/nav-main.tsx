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

export function NavMain({
  items,
}: {
  items: Array<
    {
      activePrefix: string;
      icon?: Icon;
      title: string;
    } & (
      | {
          params?: never;
          to: "/";
        }
      | {
          params: {
            tab: string;
          };
          to: "/settings/$tab";
        }
      | {
          params: {
            platform: string;
            tab: string;
          };
          to: "/clients/$platform/$tab";
        }
    )
  >;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isItemActive = (activePrefix: string) =>
    activePrefix === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(activePrefix);
  const getHref = (item: (typeof items)[number]) => {
    if (item.to === "/") {
      return "/";
    }

    if (item.to === "/settings/$tab") {
      return `/settings/${item.params.tab}`;
    }

    return `/clients/${item.params.platform}/${item.params.tab}`;
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

    if (item.to === "/") {
      void navigate({ to: item.to });
      return;
    }

    void navigate({
      to: item.to,
      params: item.params,
    });
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
