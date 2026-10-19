// Written with the help of Claude
// AI Usage: mock matching data from the Figma Stage 3 screens; reviewed by Daryna Halytska.

// The matching flow follows the jazz evening, as in Figma. Dates are shifted like the mock events (Figma's 15 жовт is
// 21 жовт here, 20 жовт is 26 жовт).
export const mockSearch = {
  eventId: '7a2d4b5c-0002-4b00-8000-000000000001',
  nextPick: 'Ср, 21 жовт · через 2 дні',
  round: 2,
  rounds: 4,
  roundsNote: 'останній за 6 год до події',
};

// The proposed match (05) and, once both agree, the mutual one (07), as in Figma.
export const mockPerson = {
  name: 'Олена',
  // Ukrainian forms the copy needs: "Поскаржитися на Олену", "Ви з Оленою", "Контакти Олени".
  accusative: 'Олену',
  instrumental: 'Оленою',
  genitive: 'Олени',
};
