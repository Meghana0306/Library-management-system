import apiClient from './api'

export const bookService = {
  getAllBooks: () => apiClient.get('/books'),
  getManageBooks: (params) => apiClient.get('/books/manage', { params }),
  createLibrarianBook: (formData) => apiClient.post('/books/manage', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateLibrarianBook: (bookId, formData) => apiClient.put(`/books/manage/${bookId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteLibrarianBook: (bookId) => apiClient.delete(`/books/manage/${bookId}`),
  bulkDeleteBooks: (bookIds) => apiClient.request({
    method: 'delete',
    url: '/books/manage/bulk-delete',
    data: { bookIds },
  }),
  bulkUpdateBooks: (payload) => apiClient.put('/books/manage/bulk-update', payload),
  getBookHistory: (bookId) => apiClient.get(`/books/manage/${bookId}/history`),
  submitBook: (formData) => apiClient.post('/books/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getPendingBooks: () => apiClient.get('/books/pending'),
  approveBook: (approvalData) => apiClient.post('/books/approve', approvalData),
  getAuthorBooks: (authorId) => apiClient.get(`/books/author/${authorId}`),
  updateAuthorBook: (authorId, bookId, updateData) => apiClient.put(`/books/author/${authorId}/${bookId}`, updateData),
  deleteAuthorBook: (authorId, bookId) => apiClient.delete(`/books/author/${authorId}/${bookId}`),
  bulkDeleteAuthorBooks: (authorId, bookIds) => apiClient.request({
    method: 'delete',
    url: `/books/author/${authorId}/bulk-delete`,
    data: { bookIds },
  }),
  generateBookSummary: ({ title, genres, style = 'medium', file = null }) => {
    if (file) {
      const formData = new FormData()
      formData.append('title', title)
      ;(genres || []).forEach((genre) => formData.append('genres', genre))
      formData.append('style', style)
      formData.append('file', file)
      return apiClient.post('/books/generate-summary', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    }
    return apiClient.post('/books/generate-summary', { title, genres, style })
  },
  getAuthorStats: (authorId) => apiClient.get(`/books/author/${authorId}/stats`),
  getAuthorStatsTrends: (authorId, period = 'monthly') => apiClient.get(`/books/author/${authorId}/stats/trends?period=${period}`),
  getDownloadedBookStats: () => apiClient.get('/books/downloaded/stats'),
  getDownloadedBookTrends: (period = 'monthly') => apiClient.get(`/books/downloaded/stats/trends?period=${period}`),
}

export const borrowService = {
  borrowBook: (bookId, userId) => apiClient.post('/borrow', { bookId, userId }),
  returnBook: (recordId) => apiClient.post(`/return/${recordId}`),
  returnBooksInBulk: (recordIds) => apiClient.post('/return/bulk', { recordIds }),
  getUserBorrowHistory: (userId) => apiClient.get(`/borrowing-records/user/${userId}`),
  getUserActiveBorrowings: (userId) => apiClient.get(`/borrowing-records/user/${userId}/active`),
  getUserActiveBorrowCount: (userId) => apiClient.get(`/borrowing-records/user/${userId}/active-count`),
  autoReturnExpiredBooks: (userId) => apiClient.post(`/borrowing-records/user/${userId}/auto-return-expired`),
  getStudentNotifications: (userId) => apiClient.get(`/notifications/user/${userId}`),
  markNotificationRead: (notificationId) => apiClient.put(`/notifications/${notificationId}/read`),
  markAllNotificationsRead: (userId) => apiClient.put(`/notifications/user/${userId}/read-all`),
  deleteNotification: (notificationId) => apiClient.delete(`/notifications/${notificationId}`),
  getRecommendations: (userId, limit = 5) => apiClient.get(`/recommendations/user/${userId}`, { params: { limit } }),
  getAllBorrowingRecords: () => apiClient.get('/borrowing-records'),
}

export const librarianService = {
  getAllUsers: (params) => apiClient.get('/librarian/users', { params }),
  createUser: (payload) => apiClient.post('/librarian/users', payload),
  updateUser: (userId, payload) => apiClient.put(`/librarian/users/${userId}`, payload),
  bulkUpdateUsers: (payload) => apiClient.put('/librarian/users/bulk-update', payload),
  bulkActivateUsers: (userIds) => apiClient.post('/librarian/users/bulk-activate', { userIds }),
  bulkDeactivateUsers: (userIds) => apiClient.post('/librarian/users/bulk-deactivate', { userIds }),
  activateUser: (userId) => apiClient.post(`/librarian/users/${userId}/activate`),
  deactivateUser: (userId) => apiClient.post(`/librarian/users/${userId}/deactivate`),
  getProfile: (userId) => apiClient.get(`/librarian/profile/${userId}`),
  updateProfile: (userId, payload) => apiClient.put(`/librarian/profile/${userId}`, payload),
  getNotifications: (params) => apiClient.get('/librarian/notifications', { params }),
}

export const reviewService = {
  submitReview: (payload) => apiClient.post('/reviews', payload),
  updateReview: (reviewId, payload) => apiClient.put(`/reviews/${reviewId}`, payload),
  getReviewsForBook: (bookId, sort = 'recent') => apiClient.get(`/reviews/book/${bookId}`, { params: { sort } }),
  getReviewsByUser: (userId) => apiClient.get(`/reviews/user/${userId}`),
  getReviewsForAuthor: (authorId) => apiClient.get(`/reviews/author/${authorId}`),
  replyToReview: (reviewId, authorId, reply) => apiClient.post(`/reviews/${reviewId}/reply`, { authorId, reply }),
  deleteReply: (reviewId, authorId) => apiClient.delete(`/reviews/${reviewId}/reply`, { data: { authorId } }),
  flagReview: (reviewId, authorId, reason) => apiClient.post(`/reviews/${reviewId}/flag`, { authorId, reason }),
  unflagReview: (reviewId, authorId) => apiClient.delete(`/reviews/${reviewId}/flag`, { data: { authorId } }),
  analyzeSentiment: (reviews) => apiClient.post('/reviews/analyze-sentiment', { reviews }),
}

export const bookRequestService = {
  submitRequest: (payload) => apiClient.post('/book-requests', payload),
  getUserRequests: (userId) => apiClient.get(`/book-requests/user/${userId}`),
  getAllRequests: (status) => apiClient.get('/book-requests', { params: status ? { status } : {} }),
  updateRequestStatus: (requestId, payload) => apiClient.put(`/book-requests/${requestId}/status`, payload),
  updateRequestPriority: (requestId, priority) => apiClient.put(`/book-requests/${requestId}/priority`, { priority }),
  downloadRequest: (requestId, payload = {}) => apiClient.post(`/book-requests/${requestId}/download`, payload),
  resolveWithAlternative: (requestId, bookId) => apiClient.post(`/book-requests/${requestId}/resolve-with-alternative/${bookId}`),
}

export const readingHistoryService = {
  getReadingHistory: (userId, filters = {}) => apiClient.get(`/reading-history/user/${userId}`, { params: filters }),
  updateReadingProgress: (recordId, progress) => apiClient.put(`/reading-progress/${recordId}`, { progress }),
}

export const systemService = {
  getAiStatus: () => apiClient.get('/system/ai-status'),
}
