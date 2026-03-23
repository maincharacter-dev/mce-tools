/**
 * Admin Users Page
 *
 * Allows admins to view and manage users in the system.
 * Users are created via the LOCAL_USERS environment variable;
 * this page allows admins to update names, emails, roles, and
 * remove users that are no longer needed.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users,
  Shield,
  User,
  Pencil,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Info,
} from "lucide-react";
import { useLocation } from "wouter";

type UserRow = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  loginMethod: string | null;
  createdAt: Date;
  lastSignedIn: Date;
};

export default function AdminUsers() {
  const [, navigate] = useLocation();
  const { data: users, isLoading, error, refetch } = trpc.adminUsers.list.useQuery();
  const { data: me } = trpc.auth.me.useQuery();

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "user" as "user" | "admin" });

  const updateMutation = trpc.adminUsers.update.useMutation({
    onSuccess: () => {
      toast.success("User updated successfully");
      setEditingUser(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.adminUsers.delete.useMutation({
    onSuccess: () => {
      toast.success("User removed");
      setDeletingUser(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function openEdit(user: UserRow) {
    setEditForm({
      name: user.name ?? "",
      email: user.email ?? "",
      role: user.role,
    });
    setEditingUser(user);
  }

  function handleUpdate() {
    if (!editingUser) return;
    updateMutation.mutate({
      openId: editingUser.openId,
      name: editForm.name || undefined,
      email: editForm.email || null,
      role: editForm.role,
    });
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">User Management</h1>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Info Banner */}
        <div className="flex items-start gap-3 bg-muted/50 border border-border rounded-lg p-4 mb-6 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground mb-1">How user management works</p>
            <p>
              Users are provisioned from the <code className="text-primary/80">LOCAL_USERS</code> environment
              variable when the server starts. Use this page to update display names, email addresses, and
              roles. To add or remove users, update <code className="text-primary/80">LOCAL_USERS</code> in
              your <code className="text-primary/80">.env</code> file and restart the container.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Total Users
            </div>
            <div className="text-2xl font-bold">{users?.length ?? "—"}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Shield className="h-4 w-4" />
              Admins
            </div>
            <div className="text-2xl font-bold">
              {users?.filter((u) => u.role === "admin").length ?? "—"}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <User className="h-4 w-4" />
              Regular Users
            </div>
            <div className="text-2xl font-bold">
              {users?.filter((u) => u.role === "user").length ?? "—"}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading users...</div>
          ) : error ? (
            <div className="p-8 text-center text-destructive">
              {error.message.includes("FORBIDDEN")
                ? "Access denied — admin role required."
                : `Error: ${error.message}`}
            </div>
          ) : !users?.length ? (
            <div className="p-8 text-center text-muted-foreground">No users found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username / ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.openId} className={me?.openId === user.openId ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium">
                      {user.name ?? <span className="text-muted-foreground italic">—</span>}
                      {me?.openId === user.openId && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {user.openId.replace("local-user-", "")}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.role === "admin" ? "default" : "secondary"}
                        className="gap-1"
                      >
                        {user.role === "admin" ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.lastSignedIn)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(user as UserRow)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingUser(user as UserRow)}
                          disabled={me?.openId === user.openId}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update display name, email, or role for{" "}
              <strong>{editingUser?.name ?? editingUser?.openId}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as "user" | "admin" }))}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Admin — full access
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      User — standard access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{deletingUser?.name ?? deletingUser?.openId}</strong> from the system?
              This will delete their database record. If they are still in{" "}
              <code>LOCAL_USERS</code>, they will be re-provisioned on next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingUser && deleteMutation.mutate({ openId: deletingUser.openId })}
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
