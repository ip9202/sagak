/**
 * Domain Types - Book, EmotionRecord, StickerType
 * Corresponds to database schema and business logic
 */

/**
 * Sticker type enum - corresponds to DB ENUM sticker_type
 * Used for EmotionRecord sticker reactions
 */
export type StickerType = 'empathy' | 'touching' | 'comforted';

/**
 * Book domain type
 */
export interface Book {
  id: string;
  title: string;
  author: string;
  coverUri?: string;
  currentPage: number;
  totalPages: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * EmotionRecord domain type
 */
export interface EmotionRecord {
  id: string;
  userId: string;
  bookId: string;
  page: number;
  content: string;
  stickerReactions: StickerReaction[];
  isSpoiler: boolean;
  createdAt: string;
}

/**
 * Sticker reaction on EmotionRecord
 */
export interface StickerReaction {
  id: string;
  type: StickerType;
  userId: string;
  createdAt: string;
}

/**
 * @MX:NOTE
 * StickerReaction component props
 * Displays 3 sticker types with toggle behavior
 */
export interface StickerReactionProps {
  selectedType?: StickerType | null;
  onTypeSelect: (type: StickerType | null) => void;
  isAuthenticated?: boolean;
  testID?: string;
}
