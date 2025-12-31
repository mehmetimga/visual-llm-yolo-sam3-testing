import 'dart:typed_data';

import 'package:flutter/foundation.dart' hide Factory;
import 'package:flutter/services.dart';
import 'package:rive/rive.dart';

/// Cached fonts for Rive files
/// Simplified from production implementation
class CachedFonts {
  final _fonts = <String, Font>{};
  final _filenameToPath = <String, String>{};

  CachedFonts._();

  static final instance = CachedFonts._();

  /// Add a font from assets
  Future<void> addFont(String path) async {
    if (_fonts.containsKey(path)) {
      return;
    }

    final font = await _loadFont(path);
    if (font == null) {
      debugPrint("CachedFonts: Can't load font: $path");
      return;
    }
    _fonts[path] = font;
    _filenameToPath[path.split("/").last] = path;
    debugPrint("CachedFonts: Loaded font: $path");
  }

  /// Get a font by unique filename
  Font? font(String uniqueFileName) {
    if (_filenameToPath.containsKey(uniqueFileName)) {
      return _fonts[_filenameToPath[uniqueFileName]];
    }

    final upper = uniqueFileName.toUpperCase();
    for (final name in _filenameToPath.keys) {
      final basename = name.split('/').last.toUpperCase();
      if (upper.contains(basename.replaceAll('.TTF', '').replaceAll('.OTF', ''))) {
        return _fonts[_filenameToPath[name]];
      }
    }

    return null;
  }

  Future<Font?> _loadFont(String path) async {
    try {
      ByteData asset = await rootBundle.load(path);
      final body = Uint8List.view(asset.buffer);
      return await Factory.rive.decodeFont(body);
    } catch (e) {
      debugPrint("CachedFonts: Error loading font $path: $e");
      return null;
    }
  }
  
  /// Check if fonts are loaded
  bool get hasLoadedFonts => _fonts.isNotEmpty;
  
  /// Get number of loaded fonts
  int get fontCount => _fonts.length;
}

