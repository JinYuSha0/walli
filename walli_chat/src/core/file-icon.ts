import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  type IconNode,
} from "lucide";

export function getFileIcon(file: { name: string; type: string }): IconNode {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type.startsWith("image/")) return FileImage;
  if (file.type.startsWith("audio/")) return FileAudio;
  if (file.type.startsWith("video/")) return FileVideo;
  if (["xls", "xlsx", "csv", "ods"].includes(extension)) return FileSpreadsheet;
  if (["ppt", "pptx", "odp", "key"].includes(extension)) return Presentation;
  if (["doc", "docx", "odt", "pdf", "rtf", "txt"].includes(extension)) return FileText;
  if (["zip", "rar", "7z", "gz", "tar"].includes(extension)) return FileArchive;
  if (
    ["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "go", "rs", "java"].includes(extension)
  )
    return FileCode2;
  return File;
}
