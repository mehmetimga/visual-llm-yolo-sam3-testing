import 'dart:async';
import 'dart:typed_data';

import 'package:rive/rive.dart';

/// Abstract base for asset loaders with unique ID
abstract class UniqueFileAssetLoader {
  final int id;
  final AssetLoaderCallback callback;

  UniqueFileAssetLoader(this.id, this.callback);
}

class _Asset {
  final String path;
  final int assetLoaderId;

  const _Asset(this.path, this.assetLoaderId);

  @override
  bool operator ==(covariant _Asset other) => path == other.path && assetLoaderId == other.assetLoaderId;

  @override
  int get hashCode => Object.hash(path, assetLoaderId);
}

/// Abstract cached assets manager
abstract class CachedAssets<T> {
  final _loadedFiles = <_Asset, T>{};
  final _activeCompleters = <_Asset, Completer<T>>{};

  Future<T> asset(String asset, {UniqueFileAssetLoader? assetLoader}) async {
    final item = _Asset(asset, assetLoader?.id ?? 0);
    if (_loadedFiles.containsKey(item)) {
      return _loadedFiles[item]!;
    }

    if (_activeCompleters.containsKey(item)) {
      return _activeCompleters[item]!.future;
    }
    final completer = Completer<T>();
    _activeCompleters[item] = completer;
    _load(asset, assetLoader).then((riveFile) {
      _loadedFiles[item] = riveFile;
      _activeCompleters.remove(item);
      completer.complete(riveFile);
    });

    return completer.future;
  }

  void release(String asset) {
    _loadedFiles.removeWhere((key, value) => key.path == asset);
  }

  Future<T> _load(String asset, [UniqueFileAssetLoader? assetLoader]);
}

/// Cached Rive files singleton
class CachedRiveFiles extends CachedAssets<File?> {
  CachedRiveFiles._();

  static final instance = CachedRiveFiles._();

  @override
  Future<File?> _load(String asset, [UniqueFileAssetLoader? assetLoader]) =>
      File.asset(asset, assetLoader: assetLoader?.callback, riveFactory: Factory.rive);
}

