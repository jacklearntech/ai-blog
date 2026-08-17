import type { ComponentType } from "react";

interface MDXComponents {
  [key: string]: ComponentType<any>;
}

export const mdxComponents: MDXComponents = {};
