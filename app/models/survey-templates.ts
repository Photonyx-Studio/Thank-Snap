export interface SurveyTemplate {
  id: string;
  name: string;
  icon: string;
  questionLabel: string;
  description: string;
  options: string[];
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: "classic-attribution",
    name: "Classic attribution",
    icon: "📺",
    questionLabel: "How did you hear about us?",
    description: "We would like to learn how you found us.",
    options: ["TV", "Podcast", "Friend or family", "Social media", "Search engine"],
  },
  {
    id: "social-first",
    name: "Social-first",
    icon: "📱",
    questionLabel: "Where did you discover us?",
    description: "Help us understand which channels are working.",
    options: [
      "Instagram",
      "TikTok",
      "Facebook",
      "YouTube",
      "Google search",
      "Friend or family",
    ],
  },
  {
    id: "marketing-channels",
    name: "Marketing channels",
    icon: "📣",
    questionLabel: "What brought you to our store today?",
    description: "We're curious what led you here.",
    options: [
      "Google ads",
      "Email newsletter",
      "Influencer or creator",
      "Word of mouth",
      "Retargeting ad",
    ],
  },
  {
    id: "short-and-simple",
    name: "Short & simple",
    icon: "⚡",
    questionLabel: "How did you find us?",
    description: "",
    options: ["Search", "Social media", "Referral", "Other"],
  },
  {
    id: "satisfaction",
    name: "Purchase satisfaction",
    icon: "⭐",
    questionLabel: "How likely are you to shop with us again?",
    description: "Your feedback helps us improve.",
    options: ["Very likely", "Likely", "Not sure", "Unlikely"],
  },
];
