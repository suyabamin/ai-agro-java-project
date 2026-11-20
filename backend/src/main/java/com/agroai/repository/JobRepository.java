package com.agroai.repository;

import com.agroai.model.EmploymentType;
import com.agroai.model.Job;
import com.agroai.model.JobCategory;
import com.agroai.model.JobStatus;
import com.google.cloud.firestore.Transaction;

import java.util.List;
import java.util.Optional;

public interface JobRepository {

    Job save(Job job);

    Optional<Job> findById(String jobId);

    List<Job> findByFarmId(String farmId);

    List<Job> findByFarmIdAndStatus(String farmId, JobStatus status);

    List<Job> findByStatus(JobStatus status);

    List<Job> findPublicJobs(String keyword, JobCategory category, EmploymentType employmentType,
                             String division, String district, Double minSalary, Double maxSalary,
                             int page, int size);

    void delete(String jobId);

    void saveInTransaction(Transaction transaction, Job job);

    Job findByIdInTransaction(Transaction transaction, String jobId);
}
