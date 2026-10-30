import { useRef, useState } from "react"
import { BookOpen, FileUp, Loader2, RefreshCw, Upload } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateShort } from "@/lib/format"
import { knowledgeDocuments } from "@/mocks/data"

const docStatusTone = {
  ready: { label: "Ready", variant: "success", dot: "bg-emerald-500" },
  processing: { label: "Processing", variant: "warning", dot: "bg-amber-500" },
  failed: { label: "Failed", variant: "danger", dot: "bg-red-500" },
} as const

export function AdminKnowledgePage() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState("returns")
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
                <Upload className="size-3.5" /> Upload document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add knowledge document</DialogTitle>
                <DialogDescription>
                  Ingestion (extract → chunk → embed → index) is implemented in Milestone 6. This form
                  demonstrates the target admin flow.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="returns">Returns</SelectItem>
                      <SelectItem value="refunds">Refunds</SelectItem>
                      <SelectItem value="shipping">Shipping</SelectItem>
                      <SelectItem value="cancellation">Cancellation</SelectItem>
                      <SelectItem value="warranty">Warranty</SelectItem>
                      <SelectItem value="faq">FAQ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <FileUp className="size-5 text-slate-400" />
                  <span className="text-[12.5px] font-medium">
                    {file ? file.name : "Click to choose a .txt / .md / .pdf file"}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground">Max 5 MB · text extracted server-side</span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.md,.pdf,.docx"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!file}
                  onClick={() => {
                    toast.success("Upload queued (demo)", {
                      description: "Real ingestion is built in Milestone 6.",
                    })
                    setOpen(false)
                    setFile(null)
                  }}
                >
                  <Upload className="size-3.5" /> Queue ingestion
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
              <p className="text-[17px] font-semibold leading-none tabular">{knowledgeDocuments.length}</p>
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
              <p className="text-[17px] font-semibold leading-none tabular">
                {knowledgeDocuments.reduce((sum, doc) => sum + doc.chunkCount, 0)}
              </p>
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
              <p className="text-[17px] font-semibold leading-none tabular">
                {knowledgeDocuments.filter((doc) => doc.status === "processing").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px]">Documents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Chunks</TableHead>
                <TableHead className="text-right">Version</TableHead>
                <TableHead>Embedding model</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {knowledgeDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{doc.category}</TableCell>
                  <TableCell><StatusBadge tone={docStatusTone[doc.status]} /></TableCell>
                  <TableCell className="text-right tabular">{doc.chunkCount}</TableCell>
                  <TableCell className="text-right tabular text-muted-foreground">v{doc.version}</TableCell>
                  <TableCell className="font-mono text-[10.5px] text-muted-foreground">{doc.embeddingModel}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{formatDateShort(doc.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-[11px]"
                      onClick={() => toast.info("Re-embedding runs in Milestone 6")}
                    >
                      Regenerate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-2 text-[10.5px] text-muted-foreground">
        Retrieval returns source chunks with document titles. The agent never answers policy questions
        without a retrieved passage.
      </p>
    </div>
  )
}
