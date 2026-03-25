import { z } from "zod";

export const CategorySchema = z.enum([
  "structure",
  "token",
  "component",
  "naming",
  "behavior",
]);

export type Category = z.infer<typeof CategorySchema>;

export const CATEGORIES = CategorySchema.options;

export const CATEGORY_LABELS: Record<Category, string> = {
  structure: "Structure",
  token: "Design Token",
  component: "Component",
  naming: "Naming",
  behavior: "Behavior",
};
