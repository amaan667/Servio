export type FeedbackType = "stars" | "multiple_choice" | "paragraph";

export interface FeedbackQuestion {

}

export type FeedbackAnswer =
  | { question_id: string; type: "stars"; answer_stars: number; order_id?: string | null }
  | {

    }
  | { question_id: string; type: "paragraph"; answer_text: string; order_id?: string | null };
