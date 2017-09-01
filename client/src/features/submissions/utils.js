
export const summarizeSubmission = (submission) => {
  if (!submission || !submission.data) {
    return null;
  } else if (submission.data['First Name'] && submission.data['Last Name']) {
    return submission.data['First Name'] +' '+ submission.data['Last Name'];
  } else {
    return submission.source + '/' + submission.external_id;
  }
}

export const completedReviews = (submission) => {
  return submission.reviews.filter((review) => review.score !== null);
}

export const incompletedReviews = (submission) => {
  return submission.reviews.filter((review) => review.score === null);
}