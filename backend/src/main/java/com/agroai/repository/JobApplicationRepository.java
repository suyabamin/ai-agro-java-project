package com.agroai.repository;

import com.agroai.model.JobApplication;
import com.google.cloud.firestore.Transaction;

import java.util.List;
import java.util.Optional;

public interface JobApplicationRepository {

    JobApplication save(JobApplication application);

    Optional<JobApplication> findById(String applicationId);

    Optional<JobApplication> findByJobIdAndApplicantUid(String jobId, String applicantUid);

    List<JobApplication> findByJobId(String jobId);

    List<JobApplication> findByFarmId(String farmId);

    List<JobApplication> findByFarmIdAndJobId(String farmId, String jobId);

    List<JobApplication> findByApplicantUid(String applicantUid);

    void saveInTransaction(Transaction transaction, JobApplication application);

    JobApplication findByIdInTransaction(Transaction transaction, String applicationId);
}
