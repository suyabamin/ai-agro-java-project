export interface AssignmentReviewRevision {
  revisionNumber: number;
  rating: number;
  comment: string | null;
  editedAt: string;
  editedBy: string;
}

export interface AssignmentReview {
  assignmentId: string;
  farmId: string;
  fieldId: string;
  authorUid: string;
  farmerUid: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  revisions: AssignmentReviewRevision[];
}

export interface CreateAssignmentReviewRequest {
  rating: number;
  comment?: string | null;
}

export interface UpdateAssignmentReviewRequest {
  rating: number;
  comment?: string | null;
}
