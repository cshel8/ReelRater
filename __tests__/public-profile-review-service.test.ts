import { createPublicProfileReviewService } from '@/services/community/publicProfileReviewService';
import type {
  FollowService,
  RemoteCommunityReviewService,
} from '@/services/contracts';

function createServices() {
  const followService = {
    getStatus: jest.fn(),
  } as unknown as jest.Mocked<FollowService>;
  const reviewService = {
    listVisibleFromAuthors: jest.fn(),
    listVisibleFromAuthor: jest.fn(),
    listVisibleFromAuthorPage: jest.fn(),
    getVisibleFromAuthor: jest.fn(),
  } as jest.Mocked<RemoteCommunityReviewService>;

  return { followService, reviewService };
}

describe('Public profile review service', () => {
  it.each([null, 'pending'] as const)(
    'requests only public reviews when relationship status is %s',
    async (status) => {
      const services = createServices();
      services.followService.getStatus.mockResolvedValue(status);
      services.reviewService.listVisibleFromAuthor.mockResolvedValue([]);
      const profileReviews = createPublicProfileReviewService(
        services.followService,
        services.reviewService
      );

      await expect(
        profileReviews.list('viewer-1', 'author-1', 15)
      ).resolves.toEqual({
        reviews: [],
        canSeeFollowersOnly: false,
      });
      expect(services.reviewService.listVisibleFromAuthor).toHaveBeenCalledWith(
        'viewer-1',
        'author-1',
        false,
        15
      );
    }
  );

  it('includes followers-only reviews for an active follower', async () => {
    const services = createServices();
    services.followService.getStatus.mockResolvedValue('active');
    services.reviewService.listVisibleFromAuthor.mockResolvedValue([]);
    const profileReviews = createPublicProfileReviewService(
      services.followService,
      services.reviewService
    );

    await expect(
      profileReviews.list('viewer-1', 'author-1')
    ).resolves.toMatchObject({ canSeeFollowersOnly: true });
    expect(services.reviewService.listVisibleFromAuthor).toHaveBeenCalledWith(
      'viewer-1',
      'author-1',
      true,
      20
    );
  });

  it('checks the relationship before loading one review', async () => {
    const services = createServices();
    services.followService.getStatus.mockResolvedValue('active');
    services.reviewService.getVisibleFromAuthor.mockResolvedValue(null);
    const profileReviews = createPublicProfileReviewService(
      services.followService,
      services.reviewService
    );

    await profileReviews.getById('viewer-1', 'author-1', 'review-1');

    expect(services.reviewService.getVisibleFromAuthor).toHaveBeenCalledWith(
      'viewer-1',
      'author-1',
      'review-1',
      true
    );
  });

  it('passes an opaque cursor through when loading another page', async () => {
    const services = createServices();
    services.followService.getStatus.mockResolvedValue(null);
    services.reviewService.listVisibleFromAuthorPage.mockResolvedValue({
      reviews: [],
      nextCursor: 'next-page',
    });
    const profileReviews = createPublicProfileReviewService(
      services.followService,
      services.reviewService
    );

    await expect(
      profileReviews.listPage('viewer-1', 'author-1', {
        cursor: 'current-page',
        maximumResults: 10,
      })
    ).resolves.toEqual({
      reviews: [],
      nextCursor: 'next-page',
      canSeeFollowersOnly: false,
    });
  });

  it('falls back to a bounded visible list while the index is missing', async () => {
    const services = createServices();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    services.followService.getStatus.mockResolvedValue('active');
    services.reviewService.listVisibleFromAuthorPage.mockRejectedValue(
      Object.assign(new Error('The query requires an index'), {
        code: 'failed-precondition',
      })
    );
    services.reviewService.listVisibleFromAuthor.mockResolvedValue([]);
    const profileReviews = createPublicProfileReviewService(
      services.followService,
      services.reviewService
    );

    await expect(
      profileReviews.listPage('viewer-1', 'author-1', {
        maximumResults: 10,
      })
    ).resolves.toEqual({
      reviews: [],
      nextCursor: null,
      canSeeFollowersOnly: true,
    });
    expect(services.reviewService.listVisibleFromAuthor).toHaveBeenCalledWith(
      'viewer-1',
      'author-1',
      true,
      10
    );
    consoleSpy.mockRestore();
  });
});
