import { type NextRequest, NextResponse } from "next/server"
import { jsPDF } from "jspdf"
import "jspdf-autotable"

export async function POST(request: NextRequest) {
  try {
    const { content, messageId } = await request.json()

    // Create PDF
    const doc = new jsPDF()

    // Add font support for French characters
    doc.setFont("helvetica")

    // Parse content
    const lines = content.split("\n")
    let yPosition = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 15

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Check if new page is needed
      if (yPosition > pageHeight - 30) {
        doc.addPage()
        yPosition = 20
      }

      // Headers
      if (line.startsWith("# ")) {
        doc.setFontSize(18)
        doc.setFont("helvetica", "bold")
        doc.text(line.replace(/^#\s*/, "").replace(/\*\*/g, ""), margin, yPosition)
        yPosition += 10
      } else if (line.startsWith("## ")) {
        doc.setFontSize(14)
        doc.setFont("helvetica", "bold")
        doc.text(line.replace(/^##\s*/, "").replace(/\*\*/g, ""), margin, yPosition)
        yPosition += 8
      } else if (line.startsWith("### ")) {
        doc.setFontSize(12)
        doc.setFont("helvetica", "bold")
        doc.text(line.replace(/^###\s*/, "").replace(/\*\*/g, ""), margin, yPosition)
        yPosition += 7
      } else if (line.startsWith("|") && !line.includes("---")) {
        // Table row - collect full table
        const tableData: string[][] = []
        let j = i

        while (j < lines.length && lines[j].trim().startsWith("|")) {
          const row = lines[j].trim()
          if (!row.includes("---")) {
            const cells = row
              .split("|")
              .slice(1, -1)
              .map((cell) => cell.trim())
            tableData.push(cells)
          }
          j++
        }

        if (tableData.length > 0) {
          // @ts-ignore - jspdf-autotable types
          doc.autoTable({
            head: [tableData[0]],
            body: tableData.slice(1),
            startY: yPosition,
            margin: { left: margin, right: margin },
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [66, 139, 202], textColor: 255 },
          })
          // @ts-ignore
          yPosition = doc.lastAutoTable.finalY + 10
          i = j - 1
        }
      } else if (line) {
        // Regular text
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        const textLines = doc.splitTextToSize(line.replace(/\*\*/g, ""), 180)
        doc.text(textLines, margin, yPosition)
        yPosition += textLines.length * 7
      } else {
        yPosition += 5
      }
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="soumission-${messageId}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json({ error: "Erreur lors de la génération du fichier PDF" }, { status: 500 })
  }
}
