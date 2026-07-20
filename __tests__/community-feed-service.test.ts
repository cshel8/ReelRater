import { createCommunityFeedService } from '@/services/community/communityFeedService';
import type {
  FollowService,
  RemoteCommunityReviewService,
  UserDirectoryService,
} from '@/services/contracts';

function createServices() {
  const followService = {
    listFollowing: jest.fn(),
  } as unknown as jest.Mocked<FollowService>;
  const directoryService = {
    getById: jest.fn(),
  } as unknown as jest.Mocked<UserDirectoryService>;
  const reviewService = {
    listVisibleFromAuthors: jest.fn(),
  } as jest.Mocked<RemoteCommunityReviewService>;

  return { followService, directoryService, reviewService };
}

describe('Community feed service', () => {
  it('does not query reviews when the viewer follows nobody', async () => {
    const services = createServices();
    services.followService.listFollowing.mockResolvedValue([]);
    const communityService = createCommunityFeedService(
      services.followService,
      services.directoryService,
      services.reviewService
    );

    await expect(communityService.list('viewer-1')).resolves.toEqual({
      reviews: [],
      followsAnyone: false,
    });
    expect(services.reviewService.listVisibleFromAuthors).not.toHaveBeenCalled();
  });

  it('attaches public author data to shared reviews', async () => {
    const services = createServices();
    services.followService.listFollowing.mockResolvedValue([
      {
        followerId: 'viewer-1',
        followedUserId: 'author-1',
        status: 'active',
        createdAt: '2026-07-19T12:00:00.000Z',
        acceptedAt: '2026-07-19T12:00:00.000Z',
      },
    ]);
    services.reviewService.listVisibleFromAuthors.mockResolvedValue([
      {
        id: 'review-1',
        authorId: 'author-1',
        movieTitle: 'Arrival',
        reviewText: 'Thoughtful science fiction.',
        rating: '5',
        visibility: 'followers',
        createdAt: '2026-07-19T12:00:00.000Z',
        syncStatus: 'synced',
      },
    ]);
    services.directoryService.getById.mockResolvedValue({
      id: 'author-1',
      displayName: 'Alex',
      handle: 'AlexMovies',
      handleNormalized: 'alexmovies',
      profileImage: null,
      accountPrivacy: 'public',
    });
    const communityService = createCommunityFeedService(
      services.followService,
      services.directoryService,
      services.reviewService
    );

    const result = await communityService.list('viewer-1', 20);

    expect(services.reviewService.listVisibleFromAuthors).toHaveBeenCalledWith(
      'viewer-1',
      ['author-1'],
      20
    );
    expect(result.followsAnyone).toBe(true);
    expect(result.reviews[0]).toMatchObject({
      id: 'review-1',
      author: {
        id: 'author-1',
        handle: 'AlexMovies',
      },
    });
  });
});
