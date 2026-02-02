import mongoose, { Schema, type Model } from 'mongoose';

export type YMD = string; // YYYY-MM-DD

export function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, schema);
}

export const MoneyCents = Number; // documentation alias
