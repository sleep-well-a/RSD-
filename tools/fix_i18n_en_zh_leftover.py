#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.303 修复 i18n-en.js 残留中文字符串（100+ 处全部翻译）

把 window.I18N_EN 字典中所有 value 含中文字符的 key 翻译为英文。
"""
import re

FILE = r'F:\自制软件\i18n-en.js'

# 翻译映射表（zh → en）
TRANSLATIONS = {
    'csvHelperMissing': 'CSV download function not defined',
    'csvMissingArgs': 'CSV export missing headers or row function arguments',
    'cvHistoryCount': ' records',
    'cvLegendContent': 'Content calc',
    'cvReportDataPoints': 'Data points',
    'dissolutionEmpty': 'Please fill in dissolution data first',
    'dryingEmpty': 'Please fill in drying loss data first',
    'errBackupMissingData': 'JSON missing data field',
    'html2pdfNotLoaded': 'html2pdf not loaded',
    'invalidEvent': 'Invalid event object',
    'lblOvenTemp': 'Oven temp (°C)',
    'needMoreData': 'At least 2 data points required',
    'needMoreDataGroup': 'Please enter at least 2 groups of valid data and calculate',
    'noContentHist': 'No external standard content history',
    'noData': 'Please enter data first',
    'noHistory': 'No history records',
    'noParallel': 'No valid parallel data',
    'noRecords': 'No records to export',
    'noSampleData': 'No sample data',
    'noSpikeHist': 'No spike recovery history',
    'noStdParams': 'Please fill in standard parameters first',
    'noTemplate': 'No templates',
    'noUndo': 'No operations to undo',
    'noValidDataCalc': 'Please enter valid data and calculate first',
    'noValidNumbers': 'No valid numbers detected',
    'normModeIndependent': 'Independent/Shared mode',
    'pdfMissing': 'PDF library not loaded',
    'placeholderInputValue': 'Enter value',
    'pleaseSelectFile': 'Please select a file to import',
    'residueEmpty': 'Please fill in residue on ignition data first',
    'restoreOk': 'Restore successful, please refresh the page',
    'sampleEmpty': 'Sample data is empty, cannot save',
    'titerEmpty': 'Please fill in titer data first',
    'titerFirstRowPh': 'First row:',
    'toast_backFmt': '↩ Back {0}',
    'toast_batchClearedFmt': '{0} (batch selection auto-cleared, please re-select)',
    'toast_batchOutputMissing': 'Batch output area missing',
    'toast_batchSelectAll': 'Selected all {0} records',
    'toast_calcInputMissing': 'calc-input missing',
    'toast_calcKeypadMissing': 'calc-keypad missing',
    'toast_clipboardFailFmt': 'Downloaded {0} (clipboard copy failed, please open manually)',
    'toast_copiedFmt': 'Copied {0} inputs',
    'toast_csvImportFailFmt': 'CSV import failed: {0}',
    'toast_curveRowsMissing': 'curve-rows container missing',
    'toast_curveSingular': 'Standard curve singular (all x values identical), cannot fit. Please check data.',
    'toast_cvReportGeneratedFmt': 'Comprehensive verification report generated: {0}',
    'toast_dataArrayMissing': 'dataArray missing',
    'toast_dataRowsMissing': 'data-rows container missing',
    'toast_extSampleRowsMissing': 'ext-sample-rows container missing',
    'toast_factoryResetOk': 'Factory reset done, refreshing page',
    'toast_factoryResetUndone': '✓ Factory reset undone',
    'toast_fileReadFail': 'File read failed',
    'toast_historyClearedFmt': '✓ Cleared {0} history records',
    'toast_historySaveFail': '⚠ History save failed: storage full or data abnormal',
    'toast_intSampleRowsMissing': 'int-sample-rows container missing',
    'toast_jsonCopiedFmt': 'JSON copied to clipboard + downloaded {0}',
    'toast_markdownCopiedFmt': 'Markdown copied to clipboard + downloaded {0}',
    'toast_mwContainerMissingFmt': 'mw-{0} container missing',
    'toast_mwInvalid': 'Molecular weight input makes denominator near 0, result invalid (check water + solvent % < 100%)',
    'toast_nameEmpty': 'Name cannot be empty',
    'toast_networkDisconnected': 'Network disconnected (probe failed)',
    'toast_networkRecovered': 'Network recovered, PDF export back to normal quality',
    'toast_noCalcOnPage': 'No matching calculation on current page',
    'toast_noExportableRecipes': 'No exportable recipe data',
    'toast_noSaveableContent': 'No saveable content on current page',
    'toast_noSearchBox': 'No search box on current page',
    'toast_noValidComponents': 'No valid components, cannot save',
    'toast_noValidRecipesFmt': 'No valid recipes detected (skipped {0} records)',
    'toast_normRegressRowsMissing': 'norm-regress-rows container missing',
    'toast_normSplRowsMissing': 'norm-spl-rows container missing',
    'toast_normStdAreaRowsMissing': 'norm-std-area-rows container missing',
    'toast_pastedFmt': 'Pasted {0} inputs',
    'toast_pleaseCopyFirst': 'Please copy first row first (click 📋 Copy button)',
    'toast_pleaseEnterRecipeName': 'Please enter recipe name first',
    'toast_pleaseSelectBatchRecipes': 'Please select recipes to batch prepare first',
    'toast_pleaseSelectCsv': 'Please select a CSV file to import',
    'toast_pleaseSelectExportRecipes': 'Please select recipes to export first',
    'toast_recContainerMissingFmt': 'rec-{0} container missing',
    'toast_recipeDeleted': 'Recipe deleted',
    'toast_recipeNameInputMissing': 'Recipe name input missing',
    'toast_recipeNotFound': 'Recipe not found',
    'toast_recipeNotFoundFmt': 'Recipe not found (index {0})',
    'toast_recipeSaveFail': 'Recipe save failed: storage full',
    'toast_renamed': 'Renamed',
    'toast_renderFnMissing': 'renderFn function missing',
    'toast_restoreUndone': '✓ Last restore undone',
    'toast_sampleDataLoaded': 'Loaded 5 sample data rows',
    'toast_sampleLoadFailFmt': 'Sample load failed: {0}',
    'toast_searchFocusedFmt': 'Search focused: {0}',
    'toast_spContainerMissingFmt': 'sp-{0} container missing',
    'toast_storageSynced': 'Synced modifications from other tabs',
    'toast_switchMwInvalid': 'switchMw unsupported type: {0} (expected {1})',
    'toast_weakNetworkCv': 'Weak network ({0}), CV report may fail if it includes cloud resources',
    'toast_weakNetworkPdf': 'Weak network ({0}), PDF export may fail if it includes cloud resources',
    'toast_xlsxLoadFail': 'XLSX library load failed, please check network and retry',
    'tplExportOk': 'Templates exported (',
    'tplImportOk': 'Imported ',
    'uiBtnAdd': '+ Add</button></div>',
    'uiBtnAddInjection': '+ Add injection</button>',
    'uiBtnAddParallel': '+ Add parallel</button>',
    'uiBtnAddPoint': '+ Add point</button>',
    'uiBtnAddRow': '+ Add row</button>',
    'uiBtnAddSample': '+ Add sample</button>',
    'uiBtnClearSample': '>Clear this sample</button>',
    'uiBtnDelete': '>Delete</button>',
    'uiBtnRename': '>Rename</button>',
    'uiCanAddParallel': 'Can add multiple parallels)</span>',
    'uiDeleteConfirmFmt': 'records? This action cannot be undone!',
    'uiNotFoundRecords': '— No matching records —</p>',
    'uiOffline': '🔴 Offline ',
    'uiOnline': '🟢 Online ',
    'uiRestoredFmt': 'items',
    'uiRetryHint': 'attempts (exponential backoff)</div>',
    'undoExpired': 'Undo expired (over 10s) or no recent restore',
    'uniformityEmpty': 'Please fill in uniformity data first',
    'xlsxMissing': 'XLSX library not loaded',
    'xlsxNotLoaded': 'XLSX not loaded',
}


def main():
    text = open(FILE, 'r', encoding='utf-8').read()
    changes = []
    for key, en_value in TRANSLATIONS.items():
        pattern = re.compile(
            r"^(\s*)" + re.escape(key) + r"\s*:\s*'[^']*[一-鿿][^']*'",
            re.MULTILINE
        )
        m = pattern.search(text)
        if m:
            old_full = m.group(0)
            new_full = m.group(1) + key + ': ' + "'" + en_value + "'"
            text = text.replace(old_full, new_full, 1)
            changes.append(key)

    print(f'Replaced {len(changes)} entries')
    for c in changes:
        print(f'  {c}')

    with open(FILE, 'w', encoding='utf-8') as f:
        f.write(text)

    # Verify
    text2 = open(FILE, 'r', encoding='utf-8').read()
    remaining = re.findall(r"'[^']*[一-鿿][^']*'", text2)
    print(f'\nRemaining Chinese values in i18n-en.js: {len(remaining)}')
    for r in remaining[:5]:
        print(f'  {r}')


if __name__ == '__main__':
    main()
