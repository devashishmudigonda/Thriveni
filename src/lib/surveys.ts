export type SurveyId = "employee" | "workmen";
export type QuestionKind = "choice" | "text" | "scale" | "textarea";

export type SurveyQuestion = {
  id: string;
  label: string;
  kind: QuestionKind;
  options?: string[];
  required?: boolean;
  section: "about" | "experience" | "feedback";
};

export type SurveyDefinition = {
  id: SurveyId;
  title: string;
  subtitle: string;
  intro: string[];
  questions: SurveyQuestion[];
};

const ageGroups = [
  "21 to 25 years",
  "26 to 30 years",
  "31 to 35 years",
  "36 to 40 years",
  "41 to 45 years",
  "46 years and above",
];

const experienceGroups = [
  "Less than 5 years",
  "6 to 10 years",
  "11 to 15 years",
  "16 to 20 years",
  "Above 20 years",
];

const scaleOptions = [
  "Strongly Disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly Agree",
];

const question = (
  id: string,
  label: string,
  kind: QuestionKind,
  section: SurveyQuestion["section"],
  options?: string[],
  required = true,
): SurveyQuestion => ({ id, label, kind, section, options, required });

const feedback = (
  id: string,
  label: string,
  required = false,
): SurveyQuestion => question(id, label, "textarea", "feedback", undefined, required);

const scale = (id: string, label: string) =>
  question(id, label, "scale", "experience", scaleOptions);

export const surveys: Record<SurveyId, SurveyDefinition> = {
  employee: {
    id: "employee",
    title: "Employee Satisfaction Survey",
    subtitle: "For direct employees of Lloyds/Thriveni",
    intro: [
      "We have been assigned by your company to conduct a survey on employee satisfaction on the various aspects of work life. We request you to give your free and frank opinion.",
      "You do not have to write your name or employee number. Your responses will be kept confidential and only a consolidated summary will be communicated to management.",
      "For each statement, choose one response on the five-point scale: Strongly Agree (5), Agree (4), Neutral (3), Disagree (2), or Strongly Disagree (1). Please respond to all statements. You may leave the open-ended questions blank.",
    ],
    questions: [
      question("age_group", "I am in the age group of", "choice", "about", ageGroups),
      question("grade", "Grade", "text", "about"),
      question("department", "Department", "text", "about"),
      question("experience_years", "Total years of work experience at Lloyds/Thriveni", "choice", "about", experienceGroups),
      question("marital_status", "Marital status", "choice", "about", ["Unmarried", "Married"]),
      question("residential_status", "Residential status", "text", "about"),
      scale("company_rules", "The rules of the company are employee friendly."),
      scale("salary_comparison", "My overall monthly salary package is comparable with what other companies in this area offer to people in my position."),
      scale("work_environment", "The company provides a positive and supportive work environment."),
      scale("work_facilities", "I am satisfied with the facilities and accessories provided for work."),
      scale("canteen_breakfast", "I am satisfied with the canteen food and refreshments offered: Breakfast."),
      scale("canteen_lunch", "I am satisfied with the canteen food and refreshments offered: Lunch."),
      scale("canteen_tea", "I am satisfied with the canteen food and refreshments offered: Tea / Coffee."),
      scale("canteen_dinner", "I am satisfied with the canteen food and refreshments offered: Dinner."),
      scale("communication", "Mostly work-related communication here is informal and friendly."),
      scale("job_satisfaction", "I experience satisfaction in my job."),
      scale("meaningful_work", "My work gives me the feeling that I am doing something worthwhile."),
      scale("recognition", "My supervisors / Engineers recognize my good work."),
      scale("development_higher_education", "The management supports me in pursuit of higher education."),
      scale("development_training", "The management nominates me for good training programmes."),
      scale("career_progression", "I am happy with my career progression in this company."),
      scale("role_clarity", "I am very clear about my roles and responsibilities."),
      scale("management_transparency", "The management is transparent about all its activities to its employees."),
      scale("leadership_targets", "My supervisors / Engineers are focused on completing work targets."),
      scale("leadership_wellbeing", "My supervisors / Engineers have concern for my well-being."),
      scale("new_ideas_acknowledged", "The management duly acknowledges and appreciates new ideas and suggestions."),
      scale("policies_fair", "The management's policies and actions are fair and just."),
      scale("experimentation", "Employees are encouraged to experiment with new ideas."),
      scale("participation", "The management encourages a high degree of employee participation."),
      scale("teamwork_department", "Teamwork is good within my department."),
      scale("teamwork_cross_department", "My teamwork with colleagues of other departments is good."),
      scale("company_welfare", "I really care about the welfare of this company."),
      scale("effort", "I am willing to put in a great deal of effort beyond what is expected to help the company succeed."),
      scale("recommend_company", "I talk about this company to my friends as a great company to work for."),
      scale("values_alignment", "I found that my values and the company's values were similar."),
      scale("decision_to_join", "I feel extremely glad that I chose to work for Lloyds/Thriveni over others I was considering at the time I joined."),
      scale("policy_agreement", "I find it easy to agree with the company's policies on important matters relating to employees."),
      scale("work_stress", "I don't experience a high degree of stress in my work."),
      scale("salary_increase", "I am satisfied with the annual salary increase I receive, which is based on my performance."),
      scale("grievances_resolved", "All grievances of the workmen have been resolved amicably on a regular basis."),
      scale("job_security", "I don't experience a feeling of job insecurity."),
      scale("family_time", "My role allows me adequate time for my family."),
      feedback("satisfied_aspects", "Specify 3 aspects of Lloyds/Thriveni you feel SATISFIED about."),
      feedback("dissatisfied_aspects", "Specify 3 aspects of Lloyds/Thriveni you feel DISSATISFIED about."),
      feedback("improvements", "Specify your suggestions for improvement in Lloyds/Thriveni."),
    ],
  },
  workmen: {
    id: "workmen",
    title: "Contract Workmen Engagement Survey",
    subtitle: "For contract workers at Lloyds/Thriveni",
    intro: [
      "We have been assigned by your company to conduct a survey on employee perception on the various aspects of work life. We request you to give your free and frank opinion.",
      "You do not have to write your name or employee number. Your responses will be kept confidential and only a consolidated summary will be communicated to management.",
      "For each statement, choose one response on the five-point scale: Strongly Agree (5), Agree (4), Neutral (3), Disagree (2), or Strongly Disagree (1). Please respond to all statements. You may leave the open-ended questions blank.",
    ],
    questions: [
      question("age_group", "I am in the age group of", "choice", "about", ageGroups),
      question("department", "Department", "text", "about"),
      question("experience_years", "Total years of work experience at Lloyds/Thriveni", "choice", "about", experienceGroups),
      question("marital_status", "Marital status", "choice", "about", ["Unmarried", "Married"]),
      question("residential_status", "Residential status", "choice", "about", ["Migrant from other state", "Local"]),
      question("contractor_name", "Name of the contractor (optional)", "text", "about", undefined, false),
      scale("company_policies", "The policies of the company are employee friendly."),
      scale("salary_fair", "My overall monthly salary package is fair."),
      scale("work_environment", "The company provides a positive and supportive work environment."),
      scale("workplace_conditions", "I am satisfied with the lighting, ventilation and cleanliness at my workplace."),
      scale("water_toilets", "Facilities such as drinking water and toilets are well maintained."),
      scale("job_resources", "I am provided with the facilities, resources and accessories required for the job."),
      scale("canteen_breakfast", "The quality of canteen food and refreshments is as per my expectation: Breakfast."),
      scale("canteen_lunch", "The quality of canteen food and refreshments is as per my expectation: Lunch."),
      scale("canteen_tea", "The quality of canteen food and refreshments is as per my expectation: Tea / Coffee."),
      scale("canteen_dinner", "The quality of canteen food and refreshments is as per my expectation: Dinner."),
      scale("supervisor_cordial", "The Supervisors / Engineers are cordial while discussing matters relating to my job here."),
      scale("job_satisfaction", "I experience satisfaction in my job."),
      scale("meaningful_work", "I feel that the work I do is meaningful and worthwhile."),
      scale("recognition", "The supervisors / Engineers recognize my good work."),
      scale("role_clarity", "I am clear about my roles and responsibilities."),
      scale("policies_fair", "The Lloyds/Thriveni management's policies and actions are fair and just."),
      scale("teamwork_department", "Teamwork is good within my department."),
      scale("leadership_targets", "The supervisors / Engineers are focused on completing work targets."),
      scale("leadership_wellbeing", "The supervisors / Engineers have concern for my well-being."),
      scale("teamwork_cross_department", "Teamwork is good between the departments."),
      scale("effort", "I am willing to contribute to the fullest of my potential towards the success of Lloyds/Thriveni."),
      scale("recommend_company", "I talk about the company to my friends as a great company to work for."),
      scale("decision_to_join", "I feel happy about my decision to work for Lloyds/Thriveni compared to other opportunities I had at the time."),
      scale("work_stress", "I don't experience a high degree of stress in my work."),
      scale("safety_awareness", "I am conscious and careful to work safely at my workplace."),
      scale("protective_equipment", "I am provided with personal protective equipment (PPE) such as helmet, safety shirt, gloves and safety shoes."),
      scale("safety_training", "I receive proper safety training at work."),
      scale("family_time", "I am able to spend adequate time with my family."),
      scale("grievances_resolved", "Grievances raised by workmen are regularly addressed and resolved amicably."),
      scale("salary_on_time", "I get my salary regularly from my Contractor on time."),
      scale("benefits_paid", "My PF and ESI contributions are regularly paid by my Contractor."),
      scale("medical_support", "My contractor supports me in getting medical treatment if I become sick."),
      feedback("satisfied_aspects", "Specify 3 aspects of Lloyds/Thriveni you feel SATISFIED about."),
      feedback("dissatisfied_aspects", "Specify 3 aspects of Lloyds/Thriveni you feel DISSATISFIED about."),
      feedback("improvements", "Specify your suggestions for improvements at Lloyds/Thriveni."),
      feedback("contractor_grievances", "Specify if you have any grievances regarding your Contractor."),
    ],
  },
};

export const responseScale = [
  { value: 1, label: "Strongly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly Agree" },
];

export const uiCopy = {
  languageHeading: "Select your language",
  languageDescription: "Choose the language you prefer for the survey.",
  languageHint: "You can change your language at any time before submitting.",
  translationNotice: "Survey questions are machine translated for accessibility.",
  changeLanguage: "Change language",
  selectSurvey: "Select a survey",
  selectSurveyDescription: "Choose the survey that applies to you.",
  employeeLabel: "Direct employees",
  workmenLabel: "Contract workmen",
  welcomeStep: "Welcome",
  welcomeTitle: "Thank you for taking a few minutes to share your experience.",
  confidential: "Confidential",
  continue: "Continue",
  back: "Back",
  next: "Next section",
  submit: "Submit survey",
  submitting: "Submitting your response...",
  sectionAbout: "About you",
  sectionExperience: "Your experience",
  sectionFeedback: "Your thoughts",
  sectionAboutHint: "A few details help us understand your responses.",
  sectionExperienceHint: "Choose the response that best reflects your experience.",
  sectionFeedbackHint: "Your comments are optional and will be kept confidential.",
  progress: "Section",
  of: "of",
  required: "Required",
  optional: "Optional",
  thanksTitle: "Thank you for sharing your voice.",
  thanksBody: "Your response has been submitted confidentially.",
  anotherResponse: "Submit another response",
  chooseOption: "Choose an option",
  enterAnswer: "Enter your answer",
  commentsPlaceholder: "Share your thoughts...",
  scaleHint: "Strongly disagree",
  scaleAgree: "Strongly agree",
  privacyNote: "Please do not include your name or employee number.",
  scaleRequired: "Please answer every statement before continuing.",
  admin: "Admin",
  adminLogin: "Admin sign in",
  adminSubtitle: "Sign in to view survey responses.",
  email: "Email address",
  password: "Password",
  signIn: "Sign in",
  signingIn: "Signing in...",
  dashboard: "Response dashboard",
  totalResponses: "Total responses",
  employeeResponses: "Employee responses",
  workmenResponses: "Workmen responses",
  languagesUsed: "Languages used",
  filterSurvey: "All surveys",
  filterLanguage: "All languages",
  exportCsv: "Export CSV",
  submitted: "Submitted",
  survey: "Survey",
  language: "Language",
  viewResponse: "View response",
  noResponses: "No responses yet",
  noResponsesHint: "Submitted surveys will appear here.",
  logout: "Sign out",
  loadError: "We couldn't load the responses. Please try again.",
  backToSurveys: "Back to surveys",
  show: "Show",
} as const;

export type UiCopyKey = keyof typeof uiCopy;
