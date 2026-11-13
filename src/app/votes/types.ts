export type PollStatus = "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED";
export interface VotingEnvelope<T> {
  success: boolean;
  message: string | string[];
  data: T;
  code?: string;
}
export interface VotingAdminLogin {
  token: string;
  name: string;
  email: string;
  level: number;
}
export interface VotingAdminSession {
  type: "voting-admin";
  token: string;
  name: string;
  email: string;
}

export interface Poll {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: PollStatus;
  currency: "NGN";
  votePriceMinor: number;
  maxVotesPerPurchase: number;
  opensAt: string;
  closesAt: string;
  resultsVisible: boolean;
  totalVotes: number | null;
  candidateCount: number;
  imageId: string | null;
  imageUrl: string | null;
}

export interface Candidate {
  id: string;
  name: string;
  bio: string;
  photoUrl: string | null;
  photoImageId: string | null;
  active: boolean;
  voteCount: number | null;
}

export interface PollDetail {
  poll: Poll;
  candidates: Candidate[];
}

export type PollInput = Pick<
  Poll,
  | "title"
  | "description"
  | "currency"
  | "votePriceMinor"
  | "maxVotesPerPurchase"
  | "opensAt"
  | "closesAt"
  | "resultsVisible"
> & { imageId?: string | null };
export type CandidateInput = Pick<Candidate, "name" | "bio"> &
  (
    | { photoImageId: string; photoUrl?: null }
    | { photoImageId?: null; photoUrl?: string | null }
  );

export type VotingImagePurpose = "POLL" | "CANDIDATE";
export interface UploadedVotingImage {
  imageId: string;
  url: string;
  publicId: string;
  purpose: VotingImagePurpose;
  width: number;
  height: number;
  bytes: number;
  format: "jpg" | "jpeg" | "png" | "webp";
}

export interface VoteAttempt {
  key: string;
  pollId: string;
  candidateId: string;
  quantity: number;
  email: string;
}

export interface Checkout {
  purchaseId: string;
  receiptToken: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: "NGN";
  quantity: number;
}

export interface VoteReceipt {
  purchaseId: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REVIEW" | "REFUNDED";
  candidateName: string;
  pollTitle: string;
  quantity: number;
  amountMinor: number;
  currency: "NGN";
  creditedVotes: number;
}
