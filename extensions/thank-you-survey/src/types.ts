export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TEXT" | "RATING";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  options: string[];
  required: boolean;
}

export type SurveyConfig =
  | { active: false }
  | {
      active: true;
      surveyId: string;
      title: string;
      description: string;
      questions: Question[];
    };

export type AnswerValue = string | string[];

export interface SubmitSurveyResponseParams {
  surveyId: string;
  answers: { questionId: string; answerValue: string }[];
  orderId?: string;
  orderNumber?: string;
}

export interface RecordSurveyViewParams {
  surveyId: string;
  orderId: string;
  orderNumber?: string;
}
