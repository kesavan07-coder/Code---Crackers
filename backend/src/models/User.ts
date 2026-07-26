import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  role: "admin" | "participant";
  department?: string;
  email?: string;
  isActive: boolean;
  currentSessionToken: string | null;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "participant"], default: "participant" },
  department: { type: String },
  email: { type: String },
  isActive: { type: Boolean, default: true },
  currentSessionToken: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IUser>("User", UserSchema);
