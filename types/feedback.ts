export type FeedbackType = "stars" | "multiple_choice" | "paragraph";

export interface FeedbackQuestion {
  id: string;
  venue_id: string;
  prompt: string;
  type: FeedbackType;
  choices: string[] | null;
  is_active: boolean;
  sort_index: number;
  created_at: string;
  updated_at: string;
}

export type FeedbackAnswer =
  | { question_id: string; type: "stars"; answer_stars: number; order_id?: string | null }
  | {
      question_id: string;
      type: "multiple_choice";
      answer_choice: string;
      order_id?: string | null;
    }
  | { question_id: string; type: "paragraph"; answer_text: string; order_id?: string | null };
