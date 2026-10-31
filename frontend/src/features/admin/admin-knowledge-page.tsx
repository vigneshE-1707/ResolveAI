import { useState } from "react"
import { BookOpen, Loader2, RefreshCw, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/feedback/states"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import { useAdminKnowledge, useDeleteKnowledge, useUploadKnowledge } from "@/lib/api/hooks"
import { formatDateShort } from "@/lib/format"

const docStatusTone = {
  ready: { label: "Ready", variant: "success", dot: "bg-emerald-500" },
  processing: { label: "Processing", variant: "warning", dot: "bg-amber-500" },
  failed: { label: "Failed", variant: "danger", dot: "bg-red-500" },
} as const

const categories = ["returns", "refunds", "shipping", "cancellation", "warranty", "faq"] as const

export function AdminKnowledgePage() {
  const knowledge = useAdminKnowledge({ pageSize: 100 })
  const upload = useUploadKnowledge()
  const remove = useDeleteKnowledge()

  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string>("returns")
  const [title, setTitle] = useState("")
  const [contentText, setContentText] = useState("")

  const documents = knowledge.data?.data ?? []
  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunkCount, 0)
  const processing = documents.filter((doc) => doc.status === "processing").length

  const resetForm = () => {
    setTitle("")
    setContentText("")
    setCategory("returns")
  }

  const submit = () => {
    upload.mutate(
      { title: title.trim(), category, contentText: contentText.trim() },
      {
        onSuccess: (result) => {
          toast.success("Document queued for ingestion", {
            description: `${result.title} — status: ${result.status}`,
          })
          setOpen(false)
          resetForm()
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Could not upload the document")
        },
      }
    )
  }

  const removeDocument = (docId: string, docTitle: string) => {
    remove.mutate(docId, {
      onSuccess: () => toast.success("Document deleted", { description: docTitle }),
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : "Could not delete the document")
      },
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Intelligence"
        title="Knowledge base"
        description="Policy documents are chunked and embedded into pgvector for grounded answers."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Upload className="size-3.5" /> Add document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add knowledge document</DialogTitle>
                <DialogDescription>
                  Paste the policy text below. Chunking and embedding are handled by the backend
                  ingestion pipeline.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-title">Title</Label>
                  <Input
                    id="doc-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Returns policy (October 2026)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((value) => (
                        <SelectItem key={value} value={value} className="capitalize">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-content">Content</Label>
                  <Textarea
                    id="doc-content"
                    value={contentText}
                    onChange={(event) => setContentText(event.target.value)}
                    placeholder="Paste the policy text…"
                    rows={6}
                  />
                  <p className="text-[10.5px] text-muted-foreground">
                    File uploads (.pdf, .docx) are not supported by the API yet — paste text for now.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={upload.isPending || !title.trim() || !contentText.trim()}
                  onClick={submit}
                >
                  {upload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  Queue ingestion
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-2.5 pt-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <BookOpen className="size-4" />
            </span>
            <div>
              <p className="text-[10.5px] text-muted-foreground">Documents</p>
              <p className="text-[17px] font-semibold leading-none tabular">{documents.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2.5 pt-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <RefreshCw className="size-4" />
            </span>
            <div>
              <p className="text-[10.5px] text-muted-foreground">Indexed chunks</p>
              <p className="text-[17px] font-semibold leading-none tabular">{totalChunks}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2.5 pt-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Loader2 className="size-4" />
            </span>
            <div>
              <p className="text-[10.5px] text-muted-foreground">Processing</p>
              <p className="text-[17px] font-semibold leading-none tabular">{processing}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px]">Documents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {knowledge.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-8 rounded-md" />
              ))}
            </div>
          ) : knowledge.isError ? (
            <EmptyState
              icon={BookOpen}
              title="Could not load the knowledge base"
              description="The knowledge service did not respond."
              action={
                <Button size="sm" variant="outline" onClick={() => void knowledge.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No documents yet"
              description="Add a policy document to ground the assistant's answers."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Chunks</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{doc.category}</TableCell>
                    <TableCell>
                      <StatusBadge tone={docStatusTone[doc.status]} />
                    </TableCell>
                    <TableCell className="text-right tabular">{doc.chunkCount}</TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">v{doc.version}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {formatDateShort(doc.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto gap-1 p-1 text-[11px] text-destructive hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => removeDocument(doc.id, doc.title)}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-2 text-[10.5px] text-muted-foreground">
        Retrieval returns source chunks with document titles. The agent never answers policy questions
        without a retrieved passage.
      </p>
    </div>
  )
}
