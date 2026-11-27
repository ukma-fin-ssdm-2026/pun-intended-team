// Written with the help of Claude
import type { ImageSource } from 'expo-image';

import type { ApiImage } from '@/api/images';

// Name forms the report sheet needs, as for the proposed match: "Поскаржитися на Ірину", "Ви з Іриною". The report is
// sent for `username`, so it reaches the API only when an account has that username.
export type Author = { name: string; accusative: string; instrumental: string; username: string };

export type Post = {
  id: string;
  initial: string;
  nameAge: string;
  author: Author;
  // "· Лук’янівка · 2 год".
  meta: string;
  text: string;
  chips?: { icon: 'calendar' | 'pin'; label: string }[];
  // A catalog event attached to the post.
  eventId?: string;
  photo?: ImageSource;
  // The photo of a listing from the API.
  apiPhoto?: ApiImage;
  // The author's profile photo, for a post from the API.
  authorPhoto?: ApiImage;
  going: boolean;
  // Only posts that come from the API have them: the heading of the post, and whether the signed-in user wrote it.
  title?: string;
  own?: boolean;
  // The signed-in user's request to join the post, from the API; undefined without one.
  myRequest?: { id: string; status: 'pending' | 'accepted' | 'declined' };
};
