// Written with the help of Claude
// Every tag an endpoint can use; Swagger UI groups endpoints by them.
export const tags = [
  { name: 'Events', description: 'Events users can go to together' },
  { name: 'Listings', description: '"Looking for company" posts' },
  { name: 'System', description: 'Service endpoints' },
] as const;

export type Tag = (typeof tags)[number]['name'];
