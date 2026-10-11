#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
demo_msoffcrypto.py — msoffcrypto-tool 集成 demo（v54.284 落地验证）

目的：验证 msoffcrypto-tool 能解密 OLE2 加密 Excel。
        适用项目 2（分析方法验证）中 `extract_encrypted_excel.py` 场景。

用法：
    python tools/demo_msoffcrypto.py

测试策略：
    1. 用 msoffcrypto 自己创建 OLE2 加密 xlsx（兼容 MS Office 加密格式）
    2. 用 msoffcrypto 解密
    3. 用 openpyxl 读解密内容
"""
import os
import io
import sys
from pathlib import Path

OUT_ROOT = Path("F:/自制软件/tools/_msoffcrypto_demo")
OUT_ROOT.mkdir(parents=True, exist_ok=True)

# 测试用密码
TEST_PASSWORD = "DemoPassword123"


def create_encrypted_xlsx(path, password):
    """用 msoffcrypto 加密 xlsx"""
    import msoffcrypto
    # 先创建普通 xlsx（用 msoffcrypto 内置）
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "样品数据"
    ws["A1"] = "样品编号"
    ws["B1"] = "浓度 (mg/mL)"
    ws["C1"] = "峰面积"
    for i in range(2, 12):
        ws[f"A{i}"] = f"S{i-1:03d}"
        ws[f"B{i}"] = round(0.1 * (i - 1), 2)
        ws[f"C{i}"] = 1000 * (i - 1)
    plain_path = path.with_suffix(".plain.xlsx")
    wb.save(plain_path)
    # 加密
    with open(plain_path, "rb") as f_in, open(path, "wb") as f_out:
        office = msoffcrypto.OfficeFile(f_in)
        office.load_key(password=password)
        office.encrypt(password, f_out)
    plain_path.unlink()  # 删除明文
    return path


def main():
    print("=" * 60)
    print("msoffcrypto-tool demo：解密 OLE2 加密 Excel")
    print("=" * 60)

    encrypted_path = OUT_ROOT / "encrypted_sample.xlsx"
    decrypted_path = OUT_ROOT / "decrypted_sample.xlsx"

    # 1. 创建加密 xlsx
    print()
    print("--- 创建 OLE2 加密 xlsx ---")
    if not encrypted_path.exists():
        try:
            create_encrypted_xlsx(encrypted_path, TEST_PASSWORD)
            print(f"[+] 加密文件: {encrypted_path.name} ({os.path.getsize(encrypted_path)} bytes)")
        except Exception as e:
            print(f"[FAIL] 创建失败: {e}")
            return 1
    else:
        print(f"[=] 已存在: {encrypted_path.name}")

    # 2. 用 msoffcrypto 解密
    print()
    print("--- 解密测试 ---")
    try:
        import msoffcrypto

        with open(encrypted_path, "rb") as f:
            office = msoffcrypto.OfficeFile(f)
            office.load_key(password=TEST_PASSWORD)

            decrypted_buf = io.BytesIO()
            office.decrypt(decrypted_buf)
            decrypted_buf.seek(0)

            with open(decrypted_path, "wb") as f_out:
                f_out.write(decrypted_buf.getvalue())
            print(f"[+] 解密成功: {decrypted_path.name} ({os.path.getsize(decrypted_path)} bytes)")

        # 3. 读解密内容
        from openpyxl import load_workbook
        wb = load_workbook(decrypted_path)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        print(f"[+] 读解密内容: {len(rows)} rows")
        print(f"    表头: {rows[0]}")
        print(f"    前 3 行: {rows[1:4]}")

    except Exception as e:
        print(f"[FAIL] 解密失败: {e}")
        return 1

    # 4. 集成路径
    print()
    print("=" * 60)
    print("集成路径")
    print("=" * 60)
    integration_path = "F:/knowledge-base/分析方法验证/qp2qr/scripts/extract_encrypted_excel.py"
    print(f"目标文件: {integration_path}")
    print("增强点: 集成 msoffcrypto 后支持 OLE2 加密格式")
    print("兼容性: MS Office 2010+ 加密 / 旧版 AES / Agile Encryption")

    return 0


if __name__ == "__main__":
    sys.exit(main())