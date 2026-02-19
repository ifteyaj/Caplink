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

export const MAJORS = [
  "Computer Science",
  "Information Technology",
  "Data Science",
  "Software Engineering",
  "Cybersecurity",
  "Computer Engineering",
  "Information Systems",
  "Other"
];

export const SKILLS = [
  "React", "Node.js", "Python", "Java", "C++", "UI/UX", "Figma", 
  "SQL", "NoSQL", "Machine Learning", "Mobile Dev", "Cloud", 
  "DevOps", "Documentation", "Project Management"
];
