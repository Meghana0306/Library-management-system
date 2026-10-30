package com.comp3111.library.service;

import com.comp3111.library.model.BorrowingRecord;
import com.comp3111.library.model.StudentNotification;
import com.comp3111.library.repository.BorrowingRecordRepository;
import com.comp3111.library.repository.StudentNotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.logging.Logger;

@Service
public class ScheduledTaskService {

    private static final Logger logger = Logger.getLogger(ScheduledTaskService.class.getName());

    @Autowired
    private BorrowingRecordRepository borrowingRecordRepository;

    @Autowired
    private StudentNotificationRepository studentNotificationRepository;

    @Autowired
    private BorrowingService borrowingService;

    /**
     * Hourly: auto-return all expired borrowings for all users.
     * Runs every hour at minute 0.
     */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void scheduledAutoReturn() {
        try {
            int count = borrowingService.autoReturnAllExpiredBorrowings();
            if (count > 0) {
                logger.info("Scheduled auto-return: processed " + count + " expired borrowing(s).");
            }
        } catch (Exception e) {
            logger.severe("Scheduled auto-return failed: " + e.getMessage());
        }
    }

    /**
     * Daily at 8:00 AM: send due-date reminder notifications for books due within 3 days.
     * Deduplicates by checking if a reminder was already sent today for the same book.
     */
    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void scheduledDueReminders() {
        try {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime threeDaysFromNow = now.plusDays(3);

            // Find all BORROWED records with due date in the next 3 days
            List<BorrowingRecord> soonDue = borrowingRecordRepository
                    .findByStatusAndDueDateBetween("BORROWED", now, threeDaysFromNow);

            int sent = 0;
            for (BorrowingRecord record : soonDue) {
                if (record.getUser() == null || record.getBook() == null) continue;

                Long userId = record.getUser().getId();
                Long bookId = record.getBook().getId();

                // Deduplicate: skip if a DUE_REMINDER was already sent today for this book/user
                LocalDateTime startOfDay = now.truncatedTo(ChronoUnit.DAYS);
                boolean alreadySent = studentNotificationRepository
                        .existsByUserIdAndCategoryAndReferenceBookIdAndCreatedAtAfter(
                                userId, "DUE_REMINDER", bookId, startOfDay);
                if (alreadySent) continue;

                long daysLeft = ChronoUnit.DAYS.between(now.toLocalDate(), record.getDueDate().toLocalDate());
                String message = buildDueReminderMessage(record.getBook().getTitle(), daysLeft);
                String priority = daysLeft <= 1 ? "HIGH" : "MEDIUM";

                StudentNotification notif = new StudentNotification();
                notif.setUserId(userId);
                notif.setCategory("DUE_REMINDER");
                notif.setTitle(daysLeft <= 0 ? "Book is overdue" : "Upcoming due date reminder");
                notif.setMessage(message);
                notif.setPriority(priority);
                notif.setReferenceBookId(bookId);
                notif.setCreatedAt(now);
                notif.setRead(false);
                studentNotificationRepository.save(notif);
                sent++;
            }
            if (sent > 0) {
                logger.info("Scheduled due reminders: sent " + sent + " reminder(s).");
            }
        } catch (Exception e) {
            logger.severe("Scheduled due reminders failed: " + e.getMessage());
        }
    }

    private String buildDueReminderMessage(String title, long daysLeft) {
        if (daysLeft < 0) return "\"" + title + "\" is overdue. Please return it immediately.";
        if (daysLeft == 0) return "\"" + title + "\" is due today. Please return it soon.";
        return "\"" + title + "\" is due in " + daysLeft + " day" + (daysLeft > 1 ? "s" : "") + ". Please plan your return.";
    }
}
