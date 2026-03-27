import type { Task, CreateTaskInput, UpdateTaskInput } from '../../domain/models/task';

export type TaskRepository = {
  readonly findByDate: (date: string) => Promise<Task[]>;
  readonly create: (input: CreateTaskInput) => Promise<Task>;
  readonly update: (id: string, input: UpdateTaskInput) => Promise<Task>;
  readonly remove: (id: string) => Promise<void>;
  readonly complete: (id: string) => Promise<Task>;
  readonly uncomplete: (id: string) => Promise<Task>;
};
