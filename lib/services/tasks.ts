import { prisma } from '../db';

export interface TaskPriority {
  level: number;
  label: 'Low' | 'Medium' | 'High' | 'Urgent';
}

export interface TaskCreate {
  title: string;
  description?: string;
  dueDate?: Date;
  priority?: number;
}

export interface TaskUpdate extends Partial<TaskCreate> {
  completed?: boolean;
}

export class TaskService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async createTask(task: TaskCreate) {
    return prisma.task.create({
      data: {
        ...task,
        userId: this.userId,
      },
    });
  }

  async updateTask(taskId: string, update: TaskUpdate) {
    return prisma.task.update({
      where: {
        id: taskId,
      },
      data: update,
    });
  }

  async deleteTask(taskId: string) {
    return prisma.task.delete({
      where: {
        id: taskId,
      },
    });
  }

  async completeTask(taskId: string) {
    return this.updateTask(taskId, { completed: true });
  }

  async listTasks(options: {
    completed?: boolean;
    priority?: number;
    dueAfter?: Date;
    dueBefore?: Date;
    searchTerm?: string;
  } = {}) {
    return prisma.task.findMany({
      where: {
        userId: this.userId,
        completed: options.completed,
        priority: options.priority,
        dueDate: {
          gte: options.dueAfter,
          lte: options.dueBefore,
        },
        OR: options.searchTerm
          ? [
              { title: { contains: options.searchTerm, mode: 'insensitive' } },
              { description: { contains: options.searchTerm, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getOverdueTasks() {
    return this.listTasks({
      completed: false,
      dueBefore: new Date(),
    });
  }

  async getUpcomingTasks(days: number = 7) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.listTasks({
      completed: false,
      dueAfter: new Date(),
      dueBefore: endDate,
    });
  }

  async getPriorityTasks(minPriority: number = 2) {
    return this.listTasks({
      completed: false,
      priority: minPriority,
    });
  }

  async getTasksByDueDate(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.listTasks({
      dueAfter: startOfDay,
      dueBefore: endOfDay,
    });
  }

  async getTaskStats() {
    const [total, completed, overdue, highPriority] = await Promise.all([
      prisma.task.count({
        where: { userId: this.userId },
      }),
      prisma.task.count({
        where: { userId: this.userId, completed: true },
      }),
      prisma.task.count({
        where: {
          userId: this.userId,
          completed: false,
          dueDate: { lt: new Date() },
        },
      }),
      prisma.task.count({
        where: {
          userId: this.userId,
          completed: false,
          priority: { gte: 2 },
        },
      }),
    ]);

    return {
      total,
      completed,
      overdue,
      highPriority,
      completion_rate: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  getPriorityLabel(priority: number): TaskPriority['label'] {
    switch (priority) {
      case 3:
        return 'Urgent';
      case 2:
        return 'High';
      case 1:
        return 'Medium';
      default:
        return 'Low';
    }
  }

  async createTaskReminder(taskId: string, reminderTime: Date) {
    // This would integrate with your notification system
    // For now, we'll just console.log
    console.log(`Reminder set for task ${taskId} at ${reminderTime}`);
  }

  async searchTasks(query: string) {
    return this.listTasks({ searchTerm: query });
  }

  async bulkUpdateTasks(taskIds: string[], update: TaskUpdate) {
    return prisma.task.updateMany({
      where: {
        id: { in: taskIds },
        userId: this.userId,
      },
      data: update,
    });
  }

  async bulkDeleteTasks(taskIds: string[]) {
    return prisma.task.deleteMany({
      where: {
        id: { in: taskIds },
        userId: this.userId,
      },
    });
  }
}