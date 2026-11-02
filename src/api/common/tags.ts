// Written with the help of Claude
// Every tag an endpoint can use; Swagger UI groups endpoints by them.
export const tags = [
  { name: 'Auth', description: 'Registration, sign-in methods and guest tokens' },
  { name: 'Events', description: 'Events users can go to together' },
  { name: 'Listings', description: '"Looking for company" posts' },
  { name: 'Profiles', description: 'The signed-in user’s profile, filled in step by step during onboarding' },
  { name: 'Interests', description: 'The fixed list of interests users pick from' },
  { name: 'Categories', description: 'The event category directory' },
  { name: 'Moderation', description: 'Reports on users and how administrators resolve them' },
  { name: 'Admin', description: 'Platform statistics for administrators' },
  { name: 'System', description: 'Service endpoints' },
] as const;

export type Tag = (typeof tags)[number]['name'];
