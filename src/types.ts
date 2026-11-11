import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  role: string;
  email_verified: boolean;
}

export interface Listing {
  id: string;
  user_id: string;
  type: 'solo' | 'group';
  name: string;
  course: string;
  major: string;
  project_idea: string;
  skills: string; // JSON string from DB
  slots_open: number | null;
  email: string | null;
  facebook: string | null;
  is_active: boolean;
  created_at: string;
  is_locked?: boolean;
}

export interface ListingStats {
  total: number;
  solo: number;
  groups: number;
}

export const MAJORS = [
  "Data Science",
  "Software Engineering",
  "Hardware Engineering",
  "Communication Engineering"
];

/**
 * Safely parse the `listings.skills` JSON string column.
 * Returns [] for null/undefined, malformed JSON, or non-array/non-string values
 * instead of crashing the caller.
 */
export function parseSkills(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((skill): skill is string => typeof skill === "string")
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0);
  } catch {
    return [];
  }
}

export const SKILLS = [
  "React", "Node.js", "Python", "Java", "C++", "UI/UX", "Figma", 
  "SQL", "NoSQL", "Machine Learning", "Mobile Dev", "Cloud", 
  "DevOps", "Documentation", "Project Management"
];
