import { useEffect, useState } from "react";

// Router dựa trên hash: #/  ·  #/ch/2/demo  ·  #/glossary  ·  #/review
export type Route =
  | { page: "home" }
  | { page: "chapter"; id: number; tab: string }
  | { page: "glossary" }
  | { page: "review" };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "ch" && parts[1]) return { page: "chapter", id: Number(parts[1]), tab: parts[2] || "read" };
  if (parts[0] === "glossary") return { page: "glossary" };
  if (parts[0] === "review") return { page: "review" };
  return { page: "home" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const href = {
  home: "#/",
  chapter: (id: number, tab = "read") => `#/ch/${id}/${tab}`,
  glossary: "#/glossary",
  review: "#/review",
};
