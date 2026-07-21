import {
  Image,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReviewMovieSnapshot } from '@/types/domain';
import { getDisplayReviewMovie } from '@/utils/reviewMovie';
import { ReviewPosterPlaceholder } from './ReviewPosterPlaceholder';

export function ReviewPoster({
  iconSize,
  movie,
  style,
  title,
}: {
  iconSize?: number;
  movie?: ReviewMovieSnapshot;
  style?: StyleProp<ViewStyle>;
  title: string;
}) {
  const displayMovie = getDisplayReviewMovie(movie);

  if (!displayMovie?.posterUrl) {
    return (
      <ReviewPosterPlaceholder
        iconSize={iconSize}
        style={style}
        title={title}
      />
    );
  }

  return (
    <Image
      accessibilityLabel={`Poster for ${title}`}
      resizeMode="cover"
      source={{
        uri:
          displayMovie.matchStatus === 'matched'
            ? displayMovie.localPosterUri ?? displayMovie.posterUrl
            : displayMovie.posterUrl,
      }}
      style={style as StyleProp<ImageStyle>}
    />
  );
}
