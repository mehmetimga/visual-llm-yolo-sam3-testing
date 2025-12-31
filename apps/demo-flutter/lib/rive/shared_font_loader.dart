import 'dart:typed_data';

import 'package:rive/rive.dart';

import 'cached_assets.dart';
import 'cached_fonts.dart';

/// Font asset loader for Rive files
/// Provides cached fonts when Rive requests them
class SharedFontAssetsLoader extends UniqueFileAssetLoader {
  SharedFontAssetsLoader(super.id, super.callback);

  // Singleton ID
  static const int _id = 1;

  factory SharedFontAssetsLoader.create() {
    bool assetCallback(FileAsset asset, Uint8List? embeddedBytes) {
      if (asset is FontAsset) {
        final font = CachedFonts.instance.font(asset.uniqueFilename);
        if (font != null) {
          return asset.font(font);
        }
        // ignore: avoid_print
        print('SharedFontAssetsLoader: Font not found: ${asset.uniqueFilename}');
      }
      return false;
    }

    return SharedFontAssetsLoader(_id, assetCallback);
  }
}

