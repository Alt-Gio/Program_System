/**
 * Intern Management API Client
 * Type-safe wrapper for all intern-related API calls
 */

export type InternStatus = 'ACTIVE' | 'COMPLETED' | 'INACTIVE' | 'ON_LEAVE';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface CreateInternData {
  fullName: string;
  school: string;
  course: string;
  department?: string;
  supervisor?: string;
  startDate: string;
  endDate: string;
  requiredHours?: number;
  email?: string;
  phone?: string;
  photoUrl?: string;
  notes?: string;
}

export interface UpdateInternData {
  fullName?: string;
  school?: string;
  course?: string;
  department?: string;
  supervisor?: string;
  startDate?: string;
  endDate?: string;
  requiredHours?: number;
  status?: InternStatus;
  email?: string;
  phone?: string;
  photoUrl?: string;
  notes?: string;
}

export interface AddAttendanceData {
  date: string;
  timeIn?: string;
  timeOut?: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface AddTaskData {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface AddDocumentData {
  name: string;
  type: string;
  url: string;
  uploadedBy?: string;
}

export interface SendEmailData {
  subject: string;
  message: string;
  type?: string;
  senderName?: string;
}

/**
 * Intern API Client
 */
export const internApi = {
  /**
   * List all interns
   */
  async list() {
    const res = await fetch('/api/interns');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Get single intern by ID
   */
  async getById(internId: string) {
    const res = await fetch(`/api/interns/${internId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Create new intern
   */
  async create(data: CreateInternData) {
    const res = await fetch('/api/interns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Update intern
   */
  async update(internId: string, data: UpdateInternData) {
    const res = await fetch(`/api/interns/${internId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Delete intern
   */
  async delete(internId: string) {
    const res = await fetch(`/api/interns/${internId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Add attendance record
   */
  async addAttendance(internId: string, data: AddAttendanceData) {
    const res = await fetch(`/api/interns/${internId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Delete attendance record
   */
  async deleteAttendance(internId: string, recordId: string) {
    const res = await fetch(`/api/interns/${internId}/attendance?recordId=${recordId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Add task
   */
  async addTask(internId: string, data: AddTaskData) {
    const res = await fetch(`/api/interns/${internId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Update task status
   */
  async updateTaskStatus(internId: string, taskId: string, status: TaskStatus) {
    const res = await fetch(`/api/interns/${internId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Delete task
   */
  async deleteTask(internId: string, taskId: string) {
    const res = await fetch(`/api/interns/${internId}/tasks?taskId=${taskId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Add document
   */
  async addDocument(internId: string, data: AddDocumentData) {
    const res = await fetch(`/api/interns/${internId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Update document tags
   */
  async updateDocumentTags(internId: string, docId: string, tags: string[]) {
    const res = await fetch(`/api/interns/${internId}/documents`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, tags }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Delete document
   */
  async deleteDocument(internId: string, docId: string) {
    const res = await fetch(`/api/interns/${internId}/documents?docId=${docId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Send email to intern
   */
  async sendEmail(internId: string, data: SendEmailData) {
    const res = await fetch(`/api/interns/${internId}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

/**
 * Supervisor API Client
 */
export const supervisorApi = {
  /**
   * Get intern detail (supervisor view with gamification)
   */
  async getIntern(internId: string) {
    const res = await fetch(`/api/supervisor/intern/${internId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Award bonus XP to intern
   */
  async awardXp(accountId: string, xp: number, reason: string) {
    const res = await fetch('/api/supervisor/award-xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, xp, reason }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
