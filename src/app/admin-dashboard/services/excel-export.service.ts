import { Injectable } from '@angular/core';

export type ExcelColumnType = 'string' | 'number' | 'currency' | 'status';
export type ExcelCellAlign = 'Left' | 'Center' | 'Right';

export interface ExcelColumn<T = any> {
  header: string;
  width?: number;
  type?: ExcelColumnType;
  align?: ExcelCellAlign;
  value: (row: T, index: number) => string | number | null | undefined;
}

export interface ExcelSummaryRow {
  label: string;
  value: string | number;
  type?: 'string' | 'number' | 'currency';
}

export interface ExcelSheetConfig<T = any> {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExcelColumn<T>[];
  data: T[];
  summaryRows?: ExcelSummaryRow[];
}

export interface ExcelWorkbookConfig {
  fileName: string;
  sheets: ExcelSheetConfig<any>[];
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

const STYLE_INDEX = {
  Default: 0,
  TitleBanner: 1,
  SubtitleBanner: 2,
  TableHeader: 3,
  TextLeftEven: 4,
  TextLeftOdd: 5,
  TextCenterEven: 6,
  TextCenterOdd: 7,
  TextRightEven: 8,
  TextRightOdd: 9,
  NumberEven: 10,
  NumberOdd: 11,
  CurrencyEven: 12,
  CurrencyOdd: 13,
  StatusSuccess: 14,
  StatusDanger: 15,
  StatusWarning: 16,
  SummaryLabel: 17,
  SummaryCurrency: 18,
  SummaryNumber: 19,
  SummaryText: 20,
} as const;

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  private readonly textEncoder = new TextEncoder();
  private readonly crcTable = this.buildCrc32Table();

  /**
   * Genera y descarga un libro nativo de Microsoft Excel (.xlsx OpenXML ZIP)
   * con soporte multi-hoja, estilos corporativos, formatos de moneda CLP y filas de resumen.
   */
  exportWorkbook(config: ExcelWorkbookConfig): boolean {
    const validSheets = config.sheets.filter(
      (s) => Array.isArray(s.data) && s.data.length > 0,
    );

    if (validSheets.length === 0) {
      return false;
    }

    const now = new Date();
    const fechaGeneracion = new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(now);
    const fechaArchivo = now.toISOString().split('T')[0];

    const entries: ZipEntry[] = [
      {
        path: '[Content_Types].xml',
        data: this.encodeUtf8(this.buildContentTypesXml(validSheets.length)),
      },
      {
        path: '_rels/.rels',
        data: this.encodeUtf8(this.buildRootRelsXml()),
      },
      {
        path: 'xl/workbook.xml',
        data: this.encodeUtf8(this.buildWorkbookXml(validSheets)),
      },
      {
        path: 'xl/_rels/workbook.xml.rels',
        data: this.encodeUtf8(this.buildWorkbookRelsXml(validSheets.length)),
      },
      {
        path: 'xl/styles.xml',
        data: this.encodeUtf8(this.buildStylesXml()),
      },
    ];

    validSheets.forEach((sheet, idx) => {
      entries.push({
        path: `xl/worksheets/sheet${idx + 1}.xml`,
        data: this.encodeUtf8(this.buildWorksheetXml(sheet, fechaGeneracion)),
      });
    });

    const xlsxBytes = this.createZipArchive(entries);
    const blob = new Blob([xlsxBytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const sanitizedBaseName = config.fileName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/gi, '-');
    const fullFileName = `${sanitizedBaseName}-${fechaArchivo}.xlsx`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fullFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  }

  private buildWorksheetXml<T>(
    sheet: ExcelSheetConfig<T>,
    fechaGeneracion: string,
  ): string {
    const colCount = Math.max(1, sheet.columns.length);
    const lastColLetter = this.getColumnLetter(colCount - 1);
    const prevColLetter = this.getColumnLetter(Math.max(0, colCount - 2));

    const colsXml = sheet.columns
      .map((col, idx) => {
        const charWidth = Math.max(10, Math.round((col.width ?? 130) / 6.5));
        return `<col min="${idx + 1}" max="${idx + 1}" width="${charWidth}" customWidth="1"/>`;
      })
      .join('');

    const subtitleText = [
      sheet.subtitle,
      `Generado: ${fechaGeneracion}`,
      `Total de registros: ${sheet.data.length}`,
    ]
      .filter(Boolean)
      .join('  |  ');

    const rowsXml: string[] = [];
    const mergeRefs: string[] = [];

    // Fila 1: Banner de título
    rowsXml.push(
      this.buildMergedBannerRow(
        1,
        30,
        colCount,
        `KINETIC RESERVATIONS — ${sheet.title.toUpperCase()}`,
        STYLE_INDEX.TitleBanner,
      ),
    );
    if (colCount > 1) {
      mergeRefs.push(`A1:${lastColLetter}1`);
    }

    // Fila 2: Subtítulo y metadatos
    rowsXml.push(
      this.buildMergedBannerRow(
        2,
        22,
        colCount,
        subtitleText,
        STYLE_INDEX.SubtitleBanner,
      ),
    );
    if (colCount > 1) {
      mergeRefs.push(`A2:${lastColLetter}2`);
    }

    // Fila 3: Espacio en blanco
    rowsXml.push(`<row r="3" ht="10" customHeight="1"/>`);

    // Fila 4: Encabezados de tabla
    const headerCells = sheet.columns
      .map((col, colIdx) => {
        const ref = `${this.getColumnLetter(colIdx)}4`;
        return this.buildStringCell(ref, col.header, STYLE_INDEX.TableHeader);
      })
      .join('');
    rowsXml.push(`<row r="4" ht="26" customHeight="1">${headerCells}</row>`);

    // Filas de datos (desde fila 5)
    let currentRowNumber = 5;
    sheet.data.forEach((row, rowIndex) => {
      const isEven = rowIndex % 2 === 0;
      const cells = sheet.columns
        .map((col, colIdx) => {
          const ref = `${this.getColumnLetter(colIdx)}${currentRowNumber}`;
          return this.buildDataCellXml(ref, col, row, rowIndex, isEven);
        })
        .join('');
      rowsXml.push(
        `<row r="${currentRowNumber}" ht="22" customHeight="1">${cells}</row>`,
      );
      currentRowNumber++;
    });

    // Filas de resumen
    const summaryRows = sheet.summaryRows || [];
    if (summaryRows.length > 0) {
      rowsXml.push(`<row r="${currentRowNumber}" ht="10" customHeight="1"/>`);
      currentRowNumber++;

      for (const summary of summaryRows) {
        const labelEndIdx = Math.max(0, colCount - 2);
        const valueColIdx = colCount - 1;
        const summaryCells: string[] = [];

        for (let c = 0; c <= labelEndIdx; c++) {
          const ref = `${this.getColumnLetter(c)}${currentRowNumber}`;
          summaryCells.push(
            this.buildStringCell(
              ref,
              c === 0 ? summary.label : '',
              STYLE_INDEX.SummaryLabel,
            ),
          );
        }

        if (colCount > 2) {
          mergeRefs.push(
            `A${currentRowNumber}:${prevColLetter}${currentRowNumber}`,
          );
        }

        const valRef = `${this.getColumnLetter(valueColIdx)}${currentRowNumber}`;
        if (summary.type === 'currency' || summary.type === 'number') {
          const num = Number(summary.value) || 0;
          const style =
            summary.type === 'currency'
              ? STYLE_INDEX.SummaryCurrency
              : STYLE_INDEX.SummaryNumber;
          summaryCells.push(this.buildNumberCell(valRef, num, style));
        } else {
          summaryCells.push(
            this.buildStringCell(
              valRef,
              String(summary.value ?? ''),
              STYLE_INDEX.SummaryText,
            ),
          );
        }

        rowsXml.push(
          `<row r="${currentRowNumber}" ht="24" customHeight="1">${summaryCells.join('')}</row>`,
        );
        currentRowNumber++;
      }
    }

    const mergeCellsXml =
      mergeRefs.length > 0
        ? `<mergeCells count="${mergeRefs.length}">${mergeRefs
            .map((ref) => `<mergeCell ref="${ref}"/>`)
            .join('')}</mergeCells>`
        : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
 <cols>${colsXml}</cols>
 <sheetData>${rowsXml.join('')}</sheetData>
 ${mergeCellsXml}
</worksheet>`;
  }

  private buildMergedBannerRow(
    rowNumber: number,
    height: number,
    colCount: number,
    text: string,
    styleIndex: number,
  ): string {
    const cells: string[] = [];
    for (let c = 0; c < colCount; c++) {
      const ref = `${this.getColumnLetter(c)}${rowNumber}`;
      cells.push(this.buildStringCell(ref, c === 0 ? text : '', styleIndex));
    }
    return `<row r="${rowNumber}" ht="${height}" customHeight="1">${cells.join('')}</row>`;
  }

  private buildDataCellXml<T>(
    cellRef: string,
    col: ExcelColumn<T>,
    row: T,
    rowIndex: number,
    isEven: boolean,
  ): string {
    const rawVal = col.value(row, rowIndex);
    const type = col.type ?? 'string';

    if (type === 'currency' || type === 'number') {
      const numericVal = Number(rawVal);
      const safeNum = Number.isFinite(numericVal) ? numericVal : 0;
      const style =
        type === 'currency'
          ? isEven
            ? STYLE_INDEX.CurrencyEven
            : STYLE_INDEX.CurrencyOdd
          : isEven
            ? STYLE_INDEX.NumberEven
            : STYLE_INDEX.NumberOdd;
      return this.buildNumberCell(cellRef, safeNum, style);
    }

    if (type === 'status') {
      const textVal = String(rawVal ?? '');
      const statusStyle = this.resolveStatusStyle(textVal);
      return this.buildStringCell(cellRef, textVal, statusStyle);
    }

    const align = col.align ?? 'Left';
    let style: number = STYLE_INDEX.TextLeftEven;
    if (align === 'Center') {
      style = isEven ? STYLE_INDEX.TextCenterEven : STYLE_INDEX.TextCenterOdd;
    } else if (align === 'Right') {
      style = isEven ? STYLE_INDEX.TextRightEven : STYLE_INDEX.TextRightOdd;
    } else {
      style = isEven ? STYLE_INDEX.TextLeftEven : STYLE_INDEX.TextLeftOdd;
    }

    return this.buildStringCell(cellRef, String(rawVal ?? ''), style);
  }

  private buildStringCell(
    cellRef: string,
    text: string,
    styleIndex: number,
  ): string {
    return `<c r="${cellRef}" s="${styleIndex}" t="inlineStr"><is><t>${this.escapeXml(text)}</t></is></c>`;
  }

  private buildNumberCell(
    cellRef: string,
    value: number,
    styleIndex: number,
  ): string {
    return `<c r="${cellRef}" s="${styleIndex}"><v>${value}</v></c>`;
  }

  private resolveStatusStyle(value: string): number {
    const normalized = value.toLowerCase().trim();
    if (
      normalized === 'pagado' ||
      normalized === 'pagada' ||
      normalized === 'completada' ||
      normalized === 'activo' ||
      normalized === 'ocupada'
    ) {
      return STYLE_INDEX.StatusSuccess;
    }
    if (
      normalized === 'cancelado' ||
      normalized === 'cancelada' ||
      normalized === 'inactivo'
    ) {
      return STYLE_INDEX.StatusDanger;
    }
    return STYLE_INDEX.StatusWarning;
  }

  private buildContentTypesXml(sheetCount: number): string {
    const sheetOverrides = Array.from(
      { length: sheetCount },
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="xml" ContentType="application/xml"/>
 <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
 <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
 ${sheetOverrides}
</Types>`;
  }

  private buildRootRelsXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }

  private buildWorkbookXml(sheets: ExcelSheetConfig<any>[]): string {
    const sheetsXml = sheets
      .map((s, idx) => {
        const name = this.sanitizeSheetName(s.sheetName, idx + 1);
        return `<sheet name="${this.escapeXml(name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <sheets>${sheetsXml}</sheets>
</workbook>`;
  }

  private buildWorkbookRelsXml(sheetCount: number): string {
    const sheetRels = Array.from(
      { length: sheetCount },
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 ${sheetRels}
 <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  }

  private buildStylesXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
 <numFmts count="2">
  <numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/>
  <numFmt numFmtId="165" formatCode="#,##0"/>
 </numFmts>
 <fonts count="9">
  <font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  <font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  <font><i/><sz val="9.5"/><color rgb="FF334155"/><name val="Calibri"/></font>
  <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  <font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  <font><b/><sz val="9.5"/><color rgb="FF166534"/><name val="Calibri"/></font>
  <font><b/><sz val="9.5"/><color rgb="FF991B1B"/><name val="Calibri"/></font>
  <font><b/><sz val="9.5"/><color rgb="FF92400E"/><name val="Calibri"/></font>
  <font><b/><sz val="10.5"/><color rgb="FF005406"/><name val="Calibri"/></font>
 </fonts>
 <fills count="11">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF005406"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF006B0A"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill>
 </fills>
 <borders count="2">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border>
   <left style="thin"><color rgb="FFCBD5E1"/></left>
   <right style="thin"><color rgb="FFCBD5E1"/></right>
   <top style="thin"><color rgb="FFCBD5E1"/></top>
   <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
   <diagonal/>
  </border>
 </borders>
 <cellStyleXfs count="1">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
 </cellStyleXfs>
 <cellXfs count="21">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="165" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="165" fontId="0" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="164" fontId="4" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="164" fontId="4" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="6" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="7" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="164" fontId="8" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="165" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
 </cellXfs>
</styleSheet>`;
  }

  /**
   * Empaqueta las entradas XML en un contenedor ZIP estándar (STORE method 0 con CRC-32)
   * compatible al 100% con el estándar ECMA-376 OpenXML (.xlsx).
   */
  private createZipArchive(entries: ZipEntry[]): Uint8Array {
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
      const nameBytes = this.encodeUtf8(entry.path);
      const dataBytes = entry.data;
      const crc = this.computeCrc32(dataBytes);
      const size = dataBytes.length;

      // Local File Header (30 bytes + name)
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true); // Local file header signature
      lv.setUint16(4, 20, true); // Version needed to extract (2.0)
      lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
      lv.setUint16(8, 0, true); // Compression method: 0 (STORE)
      lv.setUint16(10, 0, true); // Last mod file time
      lv.setUint16(12, 0x555b, true); // Last mod file date
      lv.setUint32(14, crc, true); // CRC-32
      lv.setUint32(18, size, true); // Compressed size
      lv.setUint32(22, size, true); // Uncompressed size
      lv.setUint16(26, nameBytes.length, true); // File name length
      lv.setUint16(28, 0, true); // Extra field length
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, dataBytes);

      // Central Directory File Header (46 bytes + name)
      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true); // Central file header signature
      cv.setUint16(4, 20, true); // Version made by
      cv.setUint16(6, 20, true); // Version needed to extract
      cv.setUint16(8, 0x0800, true); // UTF-8 flag
      cv.setUint16(10, 0, true); // Compression method: 0 (STORE)
      cv.setUint16(12, 0, true); // Last mod time
      cv.setUint16(14, 0x555b, true); // Last mod date
      cv.setUint32(16, crc, true); // CRC-32
      cv.setUint32(20, size, true); // Compressed size
      cv.setUint32(24, size, true); // Uncompressed size
      cv.setUint16(28, nameBytes.length, true); // File name length
      cv.setUint16(30, 0, true); // Extra field length
      cv.setUint16(32, 0, true); // File comment length
      cv.setUint16(34, 0, true); // Disk number start
      cv.setUint16(36, 0, true); // Internal file attributes
      cv.setUint32(38, 0, true); // External file attributes
      cv.setUint32(42, offset, true); // Relative offset of local header
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + size;
    }

    const centralDirOffset = offset;
    const centralDirSize = centralParts.reduce((sum, p) => sum + p.length, 0);

    // End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true); // EOCD signature
    ev.setUint16(4, 0, true); // Number of this disk
    ev.setUint16(6, 0, true); // Disk where central directory starts
    ev.setUint16(8, entries.length, true); // Total entries on this disk
    ev.setUint16(10, entries.length, true); // Total entries in central directory
    ev.setUint32(12, centralDirSize, true); // Size of central directory
    ev.setUint32(16, centralDirOffset, true); // Offset of central directory
    ev.setUint16(20, 0, true); // Comment length

    const totalSize = centralDirOffset + centralDirSize + 22;
    const output = new Uint8Array(totalSize);
    let cursor = 0;

    for (const part of localParts) {
      output.set(part, cursor);
      cursor += part.length;
    }
    for (const part of centralParts) {
      output.set(part, cursor);
      cursor += part.length;
    }
    output.set(eocd, cursor);

    return output;
  }

  private buildCrc32Table(): Uint32Array {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    return table;
  }

  private computeCrc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = this.crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private getColumnLetter(colIndex: number): string {
    let letter = '';
    let temp = colIndex;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  private encodeUtf8(str: string): Uint8Array {
    return this.textEncoder.encode(str);
  }

  private sanitizeSheetName(name: string, index: number): string {
    return (
      name
        .replace(/[:\\/?*[\]]/g, '')
        .trim()
        .slice(0, 31) || `Hoja${index}`
    );
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
