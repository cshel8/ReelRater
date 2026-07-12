export type AuthUser = {
  id: string;
};

export type UserProfile = {
  id: string;
  username: string;
  profileImage: string | null;
};

export type Review = {
  id: string;
  movieTitle: string;
  reviewText: string;
  rating: string;
};

export type CreateReviewInput = Omit<Review, 'id'>;
